import WebSocketReporter from '../WebSocketReporter';
import type { ReportEvent, TestReport } from '../types';

// Internal: Minimal stand-in for the global WebSocket, recording everything
// the reporter sends.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  // 1 = OPEN, matching the real WebSocket readyState values.
  readyState = 1;
  sent: string[] = [];
  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  // Internal: The parsed events this socket received.
  events(): ReportEvent[] {
    return this.sent.map((data) => JSON.parse(data) as ReportEvent);
  }
}

function emptyReport(): TestReport {
  return {
    results: [],
    fullResults: { time: 0, timestamp: new Date().toISOString(), testCases: [] },
    errorCount: 0,
    duration: 0,
  };
}

function socket(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

describe('WebSocketReporter', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as any).WebSocket;
  });

  it('is a realtime reporter', () => {
    expect(new WebSocketReporter().type).toBe('realtime');
  });

  it('connects to the default CLI address on start', () => {
    const reporter = new WebSocketReporter({ forwardConsole: false });
    reporter.onStart();

    expect(socket().url).toBe('ws://127.0.0.1:8082/');
    reporter.onFinish(emptyReport());
  });

  it('honours a custom host and port', () => {
    const reporter = new WebSocketReporter({
      host: 'localhost',
      port: 9000,
      forwardConsole: false,
    });
    reporter.onStart();

    expect(socket().url).toBe('ws://localhost:9000/');
    reporter.onFinish(emptyReport());
  });

  it('sends single results as they arrive', () => {
    const reporter = new WebSocketReporter({ forwardConsole: false });
    reporter.onStart();

    reporter.send({ message: 'Suite: passes  ✅', passed: true });

    expect(socket().events()).toEqual([
      { event: 'singleResult', data: { message: 'Suite: passes  ✅', passed: true } },
    ]);
    reporter.onFinish(emptyReport());
  });

  it('sends the final report as testingComplete', () => {
    const reporter = new WebSocketReporter({ forwardConsole: false });
    reporter.onStart();
    const report = emptyReport();

    reporter.onFinish(report);

    expect(socket().events()).toEqual([{ event: 'testingComplete', data: report }]);
  });

  it('does not throw when the socket is not open', () => {
    const reporter = new WebSocketReporter({ forwardConsole: false });
    reporter.onStart();
    // 3 = CLOSED.
    socket().readyState = 3;

    expect(() => reporter.send({ message: 'nope', passed: true })).not.toThrow();
    expect(() => reporter.onFinish(emptyReport())).not.toThrow();
    expect(socket().sent).toHaveLength(0);
  });

  it('forwards console output and restores the console afterwards', () => {
    const original = console.log;
    const reporter = new WebSocketReporter();
    reporter.onStart();

    expect(console.log).not.toBe(original);
    console.log('hello');

    const messages = socket()
      .events()
      .filter((event) => event.event === 'message');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toMatchObject({ level: 'log' });
    expect((messages[0].data as { message: string }).message).toContain('hello');

    reporter.onFinish(emptyReport());
    expect(console.log).toBe(original);
  });

  it('does not forward console output when disabled', () => {
    const original = console.log;
    const reporter = new WebSocketReporter({ forwardConsole: false });
    reporter.onStart();

    expect(console.log).toBe(original);
    reporter.onFinish(emptyReport());
  });
});
