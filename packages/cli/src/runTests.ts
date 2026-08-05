import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, renameSync } from 'fs';

import ReportServer from './server';
import type { Platform } from './screenshot';

// Internal: Port the app's reporter connects to. Must match the default in
// react-native-cavynext's WebSocketReporter.
const REPORT_PORT = 8082;

// Internal: Default number of minutes to wait for the app to boot.
const BOOT_TIMEOUT = 2;

// Internal: Filename the real entry file is parked under while tests run.
const BACKUP_ENTRY_FILE = 'index.notest.js';

// Internal: Default build command used for react-native-web runs.
const WEB_BUILD_CMD = 'npx webpack serve --mode development --open';

// Public: The run commands the CLI supports.
export type RunCommand = 'run-ios' | 'run-android' | 'run-web' | 'run-vega';

// Public: Everything `runTests` needs to know.
export interface RunTestsOptions {
  // Which platform to run on.
  command: RunCommand;
  // App entry file. Defaults to 'index.js' (or 'index.web.js' for run-web).
  file?: string;
  // Skip the build step and just start the report server.
  skipbuild?: boolean;
  // A custom command used to build and run the app.
  buildCmd?: string;
  // Keep the report server alive after the run finishes.
  dev?: boolean;
  // Write a JUnit XML report.
  xml?: boolean;
  // Write a markdown summary.
  markdown?: boolean;
  // Capture a screenshot after every test.
  screenshots?: boolean;
  // Minutes to wait for the app to boot.
  bootTimeout?: number;
  // Extra arguments forwarded to the build command.
  args?: string[];
}

// Internal: Whether we swapped the entry files and therefore owe a teardown.
let switched = false;

// Internal: Long-running build process (e.g. a webpack dev server) that must be
// cleaned up when cavynext exits.
let childProcess: ChildProcess | undefined;

// Internal: Converts minutes to milliseconds.
function minsToMillisecs(mins: number): number {
  return mins * 60 * 1000;
}

// Internal: Map a run command to the platform used for screenshots.
function platformFor(command: RunCommand): Platform {
  switch (command) {
    case 'run-android':
      return 'android';
    case 'run-ios':
      return 'ios';
    case 'run-web':
      return 'web';
    case 'run-vega':
      return 'kepler';
  }
}

// Internal: Swap the user's test entry file into place so the built app boots
// into the Tester, keeping the real entry file safe for later.
function switchEntryFile(entryFile: string, testEntryFile: string): void {
  console.log(
    `cavynext: found a ${testEntryFile} entry point. Temporarily replacing ${entryFile} to run tests.`,
  );

  renameSync(entryFile, BACKUP_ENTRY_FILE);
  renameSync(testEntryFile, entryFile);

  switched = true;
}

// Internal: Undo `switchEntryFile`.
function teardown(entryFile: string, testEntryFile: string): void {
  console.log(`cavynext: putting your ${entryFile} back.`);

  renameSync(entryFile, testEntryFile);
  renameSync(BACKUP_ENTRY_FILE, entryFile);
  switched = false;
}

// Internal: Borrowed from the React Native CLI.
function getAdbPath(): string {
  return process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
}

// Internal: Reverse the report port so an Android device or emulator can reach
// the report server running on the host.
function runAdbReverse(): void {
  try {
    const adbPath = getAdbPath();
    const adbArgs = ['reverse', `tcp:${REPORT_PORT}`, `tcp:${REPORT_PORT}`];
    console.log(`cavynext: running ${adbPath} ${adbArgs.join(' ')}`);
    execFileSync(adbPath, adbArgs, { stdio: 'inherit' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Could not run adb reverse: ${message}.`);
    process.exit(1);
  }
}

// Internal: Start the report server and wait for the app to connect.
function runServer(options: RunTestsOptions): void {
  const server = new ReportServer({
    platform: platformFor(options.command),
    dev: options.dev,
    outputAsXml: options.xml,
    outputAsMarkdown: options.markdown,
    screenshots: options.screenshots,
  });

  server.listen(REPORT_PORT, () => {
    if (options.command === 'run-android') {
      runAdbReverse();
    }
    console.log(`cavynext: listening on port ${REPORT_PORT} for test results...`);

    if (options.skipbuild) {
      // The app is already running, so there is nothing to wait for.
      if (options.bootTimeout) {
        console.log('cavynext: --boot-timeout is ignored when used with --skipbuild');
      }
      return;
    }

    const timeout = options.bootTimeout || BOOT_TIMEOUT;
    setTimeout(() => {
      if (!server.appBooted) {
        console.log(`cavynext: no response from the app within ${timeout} minutes.`);
        console.log('cavynext: terminating.');
        process.exit(1);
      }
    }, minsToMillisecs(timeout));
  });
}

// Public: Build the app if needed, then start the report server and wait for
// results.
export default function runTests(options: RunTestsOptions): void {
  // The default entry file differs for web because react-native-web apps often
  // use an `index.web.js` entry point.
  const defaultEntryFile =
    options.command === 'run-web' && existsSync('index.web.js') ? 'index.web.js' : 'index.js';
  const entryFile = options.file || defaultEntryFile;
  const jsExtension = /\.js$/;

  if (!jsExtension.test(entryFile)) {
    console.log('cavynext: please provide an app entry file that ends in .js');
    process.exit(1);
  }

  // The test entry point sits alongside it. For `index.web.js` we expect
  // `index.test.web.js`; otherwise `index.test.js`.
  const testEntryFile = entryFile.endsWith('.web.js')
    ? entryFile.replace(/\.web\.js$/, '.test.web.js')
    : entryFile.replace(jsExtension, '.test.js');
  const testEntryFileExists = existsSync(testEntryFile);

  // Warn and exit if the user named an entry file but has no test counterpart.
  if (options.file && !testEntryFileExists) {
    console.log(`cavynext: could not find test entry point named ${testEntryFile}.`);
    process.exit(1);
  }

  if (testEntryFileExists) {
    switchEntryFile(entryFile, testEntryFile);
  }

  // Always restore the entry files and kill any long-running build process,
  // however we exit.
  process.on('exit', () => {
    if (switched) {
      teardown(entryFile, testEntryFile);
    }
    childProcess?.kill();
  });
  process.on('SIGINT', () => {
    console.log('cavynext: received SIGINT, cleaning up');
    process.exit(1);
  });

  if (options.skipbuild) {
    runServer(options);
    return;
  }

  // Build the app first, then start the server and wait for results.
  if (options.command === 'run-web') {
    // For react-native-web, the build step is a long-running dev server. Start
    // it in the background and launch the report server straight away; the boot
    // timeout will catch a server that fails to serve the app.
    const command = options.buildCmd ?? WEB_BUILD_CMD;
    childProcess = spawn(command, { stdio: 'inherit', shell: true });
    console.log(`cavynext: running \`${command}\`...`);
    runServer(options);
  } else if (options.buildCmd) {
    childProcess = spawn(options.buildCmd, { stdio: 'inherit', shell: true });
    console.log(`cavynext: running \`${options.buildCmd}\`...`);
    childProcess.on('close', (code) => {
      console.log(`cavynext: the build exited with code ${code}.`);
      if (code) {
        process.exit(code);
      }
      runServer(options);
    });
  } else {
    const rnArgs = ['react-native', options.command, ...(options.args ?? [])];
    childProcess = spawn('npx', rnArgs, { stdio: 'inherit', shell: true });
    console.log(`cavynext: running \`npx ${rnArgs.join(' ')}\`...`);
    childProcess.on('close', (code) => {
      console.log(`cavynext: the build exited with code ${code}.`);
      if (code) {
        process.exit(code);
      }
      runServer(options);
    });
  }

  if (childProcess) {
    childProcess.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`cavynext: could not start the build process: ${message}`);
      process.exit(1);
    });
  }
}
