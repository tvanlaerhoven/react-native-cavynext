import type { LogMessage, RealtimeReporter, ReportEvent, SingleResult, TestReport } from './types';

// Internal: How often a keep-alive notification is sent to the CLI. The CLI
// treats a missing notification as a crashed app.
const NOTIFY_INTERVAL = 10_000;

// Internal: WebSocket.readyState value meaning the connection is OPEN.
const WEBSOCKET_OPEN = 1;

// Public: Options for the default reporter.
export interface WebSocketReporterOptions {
  // Host the CLI report server listens on. Defaults to '127.0.0.1'.
  host?: string;
  // Port the CLI report server listens on. Defaults to 8082.
  port?: number;
  // Whether to mirror console output to the CLI. Defaults to true.
  forwardConsole?: boolean;
}

// Public: The default reporter, which streams results to
// react-native-cavynext-cli over a websocket.
//
// It is a realtime reporter: the Tester calls `onStart` when it mounts, the
// TestRunner calls `send` after every test, and `onFinish` once the suite ends.
export default class WebSocketReporter implements RealtimeReporter {
  readonly type = 'realtime' as const;

  private readonly url: string;
  private readonly forwardConsole: boolean;

  private ws?: WebSocket;
  private notifyInterval?: ReturnType<typeof setInterval>;
  // Internal: Original console functions, restored when the run finishes.
  private originalConsole: Partial<Record<LogMessage['level'], (...args: any[]) => void>> = {};

  constructor(options: WebSocketReporterOptions = {}) {
    const { host = '127.0.0.1', port = 8082, forwardConsole = true } = options;
    this.url = `ws://${host}:${port}/`;
    this.forwardConsole = forwardConsole;
  }

  // Internal: Creates a websocket connection to the CLI report server and
  // starts forwarding console output.
  onStart(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onerror = (event) => {
      // Logged with the original console function to avoid recursing into the
      // forwarding wrapper while the socket is failing.
      (this.originalConsole.error ?? console.error)('cavynext: websocket error', event);
    };

    if (this.forwardConsole) {
      this.overrideConsole('log');
      this.overrideConsole('debug');
      this.overrideConsole('warn');
      this.overrideConsole('error');
    }

    // Start sending keep-alive notifications so the CLI knows we're alive.
    this.startNotify();
  }

  // Internal: Send a single test result to the CLI.
  send(result: SingleResult): void {
    this.sendData({ event: 'singleResult', data: result });
  }

  // Internal: Send the final report to the CLI, then clean up.
  onFinish(report: TestReport): void {
    if (this.websocketReady()) {
      this.sendData({ event: 'testingComplete', data: report });
    } else {
      // If the CLI is not running, let people know in a friendly way.
      console.log(
        'cavynext: skipping sending the test report - no CLI report server ' +
          'detected. Run your app via `cavynext run-ios` / `run-android` to ' +
          'collect results.',
      );
    }

    this.stopNotify();
    this.restoreConsole();
  }

  // Private: Begin the keep-alive heartbeat.
  private startNotify(): void {
    this.notifyInterval = setInterval(() => {
      this.sendData({ event: 'notify', data: {} });
    }, NOTIFY_INTERVAL);
  }

  // Private: Stop the keep-alive heartbeat.
  private stopNotify(): void {
    if (this.notifyInterval) {
      clearInterval(this.notifyInterval);
      this.notifyInterval = undefined;
    }
  }

  // Private: Mirror one console function to the CLI, keeping local output too.
  private overrideConsole(level: LogMessage['level']): void {
    // The original function is stored as-is (not bound) so that `onFinish` can
    // restore the exact same reference, otherwise repeated runs would stack
    // wrappers on top of each other.
    const original = console[level];
    this.originalConsole[level] = original;

    console[level] = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      original.apply(console, [`[${timestamp}]`, ...args]);
      this.sendData({
        event: 'message',
        data: {
          message: `${level.toUpperCase()} ${new Date().toLocaleTimeString()} ${args.join(' ')}`,
          level,
        },
      });
    };
  }

  // Private: Put the original console functions back.
  private restoreConsole(): void {
    for (const [level, original] of Object.entries(this.originalConsole)) {
      if (original) {
        console[level as LogMessage['level']] = original;
      }
    }
    this.originalConsole = {};
  }

  // Private: Determines whether data can be sent over the websocket.
  private websocketReady(): boolean {
    return this.ws?.readyState === WEBSOCKET_OPEN;
  }

  // Private: Sends an event over the websocket, swallowing (but logging)
  // failures so a reporting problem never fails the test run.
  private sendData(event: ReportEvent): void {
    if (!this.websocketReady()) {
      return;
    }

    try {
      this.ws?.send(JSON.stringify(event));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      (this.originalConsole.warn ?? console.warn)(`cavynext: error sending test data: ${message}`);
    }
  }
}
