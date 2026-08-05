import http from 'http';

import chalk from 'chalk';
import { WebSocketServer } from 'ws';
import type { LogMessage, ReportEvent, SingleResult, TestReport } from 'react-native-cavynext';

import constructXML from './junitFormatter';
import constructMarkdown from './markdownFormatter';
import takeScreenshot, { type Platform } from './screenshot';

// Internal: How long to wait for a keep-alive notification from the app before
// assuming it has crashed. The app notifies every 10 seconds.
const KEEP_ALIVE_TIMEOUT = 60_000;

// Internal: Exit code used when tests ran but some failed. Distinct from 1 so a
// test failure can be told apart from a build failure.
const TEST_FAILURE_EXIT_CODE = 42;

// Public: Configuration for the report server.
export interface ReportServerOptions {
  // Which platform the app under test runs on; used for screenshots.
  platform?: Platform;
  // Keep the server alive after a run finishes, instead of exiting.
  dev?: boolean;
  // Write a JUnit XML report when the run finishes.
  outputAsXml?: boolean;
  // Write a markdown summary when the run finishes.
  outputAsMarkdown?: boolean;
  // Capture a screenshot after every test result.
  screenshots?: boolean;
}

// Public: The websocket server that receives results from the app under test.
//
// The app connects, streams console output and individual results, and finally
// sends the full report. The server prints progress and decides the process
// exit code.
export default class ReportServer {
  // Internal: Set once the app has connected, so the boot timeout can tell
  // "still building" apart from "crashed on launch".
  appBooted = false;

  private readonly options: ReportServerOptions;
  private readonly server: http.Server;
  private readonly wss: WebSocketServer;

  private testCount = 0;
  private keepAliveTimeout?: NodeJS.Timeout;

  constructor(options: ReportServerOptions = {}) {
    this.options = options;
    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (socket) => {
      socket.on('message', (raw) => {
        this.handleEvent(JSON.parse(raw.toString()) as ReportEvent);
      });

      // Now that the app has connected we know it booted successfully.
      this.appBooted = true;
      this.onNotify();
    });
  }

  // Public: Start listening. `onListening` runs once the port is bound.
  listen(port: number, onListening: () => void): void {
    // Without this, a port clash surfaces as an unhandled 'error' event and a
    // raw stack trace, which tells the user nothing actionable.
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.log(
          chalk.red(
            `cavynext: port ${port} is already in use. Another cavynext run is ` +
              'probably still going - stop it and try again.',
          ),
        );
        process.exit(1);
      }
      console.log(chalk.red(`cavynext: report server error: ${error.message}`));
      process.exit(1);
    });

    this.server.listen(port, onListening);
  }

  // Internal: Route an incoming event to its handler.
  private handleEvent(event: ReportEvent): void {
    switch (event.event) {
      case 'notify':
        this.onNotify(this.options.screenshots);
        break;
      case 'message':
        this.logMessage(event.data);
        break;
      case 'singleResult':
        this.logTestResult(event.data);
        break;
      case 'testingComplete':
        this.finishTesting(event.data);
        break;
    }
  }

  // Internal: Print a single test result, numbered in the order received.
  private logTestResult(result: SingleResult): void {
    this.testCount++;
    const formattedMessage = `${this.testCount}) ${result.message}`;

    if (this.options.screenshots) {
      takeScreenshot(this.options.platform, String(this.testCount));
    }

    console.log(result.passed ? chalk.green(formattedMessage) : chalk.red(formattedMessage));
  }

  // Internal: Print console output forwarded from the app, colour-coded by
  // level.
  private logMessage({ message, level }: LogMessage): void {
    switch (level) {
      case 'log':
        console.log(chalk.white(message));
        break;
      case 'debug':
        console.log(chalk.yellow(message));
        break;
      case 'warn':
        console.log(chalk.bgYellow(message));
        break;
      case 'error':
        console.log(chalk.red(message));
        break;
    }
  }

  // Internal: Reset the crash watchdog. If no notification arrives within
  // KEEP_ALIVE_TIMEOUT the app is presumed dead and we bail out, so CI does not
  // hang forever.
  private onNotify(screenshot = false): void {
    console.log(chalk.white(`[${new Date().toLocaleTimeString()}] Received notification.`));

    if (screenshot) {
      takeScreenshot(this.options.platform);
    }

    clearTimeout(this.keepAliveTimeout);
    this.keepAliveTimeout = setTimeout(() => {
      console.log(
        chalk.red('Did not receive a keep-alive notification in time - the app may have crashed.'),
      );
      takeScreenshot(this.options.platform, 'crash');
      process.exit(1);
    }, KEEP_ALIVE_TIMEOUT);
  }

  // Internal: Print the summary, write any requested report files and exit
  // with a code reflecting the outcome.
  private finishTesting(report: TestReport): void {
    const { results, fullResults, errorCount, duration } = report;

    // Reset the counter so numbering restarts if `--dev` keeps us running.
    this.testCount = 0;
    clearTimeout(this.keepAliveTimeout);

    console.log(`Finished in ${duration} seconds`);
    const endMsg = `${countString(results.length, 'example')}, ${countString(errorCount, 'failure')}`;

    if (this.options.outputAsXml) {
      constructXML(fullResults);
    }
    if (this.options.outputAsMarkdown) {
      constructMarkdown(fullResults);
    }

    console.log(errorCount ? chalk.red(endMsg) : chalk.green(endMsg));

    if (!this.options.dev) {
      process.exit(errorCount ? TEST_FAILURE_EXIT_CODE : 0);
    }

    console.log('--------------------');
    // Waiting for the next run, so restart the watchdog.
    this.onNotify();
  }
}

// Internal: Takes a count and a noun, returns a pluralised string.
// e.g. countString(5, 'failure') => '5 failures'
//      countString(1, 'failure') => '1 failure'
function countString(count: number, str: string): string {
  return `${count} ${count === 1 ? str : `${str}s`}`;
}
