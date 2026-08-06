import type TestScope from './TestScope';
import type {
  Reporter,
  TestCase,
  TestFn,
  TestHost,
  TestReport,
  TestResult,
  RealtimeReporter,
} from './types';

// Internal: TestRunner is responsible for actually running through each suite
// of tests and executing the specs.
//
// It also presents the test results and hands the final report to the reporter.
//
// host       - the object that can re-render the app and clear storage between
//              test cases (the Tester component).
// testSuites - an array of TestScopes, each relating to a single spec file.
// startDelay - length of time in ms to wait before starting tests.
// reporter   - the reporter that receives results.
// filter     - an array of tags dictating the subset of tagged tests to run, or
//              undefined if all tests should run.
export default class TestRunner {
  private readonly host: TestHost;
  private readonly testSuites: TestScope[];
  private readonly startDelay: number;
  private readonly reporter: Reporter;
  private readonly filter?: string[];

  private readonly results: TestResult[] = [];
  private errorCount = 0;

  constructor(
    host: TestHost,
    testSuites: TestScope[],
    startDelay: number,
    reporter: Reporter,
    filter?: string[],
  ) {
    this.host = host;
    this.testSuites = testSuites;
    this.startDelay = startDelay;
    this.reporter = reporter;
    this.filter = filter;
  }

  // Internal: Start tests after the optional delay.
  async run(): Promise<void> {
    if (this.startDelay) {
      await this.pause(this.startDelay);
    }
    await this.runTestSuites();
  }

  // Internal: Synchronously runs each test suite one after the other, then
  // reports the results.
  async runTestSuites(): Promise<void> {
    const start = new Date();
    console.log(`cavynext test suite started at ${start.toISOString()}.`);

    // When any test is focused (fit/fdescribe), only focused tests run.
    const hasFocused = this.testSuites.some((scope) =>
      scope.testCases.some((testCase) => testCase.focused && !testCase.skipped),
    );

    // Iterate through each suite...
    for (const scope of this.testSuites) {
      // ...and then through that suite's test cases.
      const runnable = scope.testCases.filter((testCase) => this.shouldRun(testCase));
      let ranAny = false;

      for (const testCase of runnable) {
        if (testCase.skipped || (hasFocused && !testCase.focused)) {
          this.skipTest(testCase);
          continue;
        }

        // `beforeAll` runs immediately before the suite's first real test, so
        // a fully skipped suite never pays its setup cost.
        if (!ranAny && scope.beforeAllHook) {
          await this.runSuiteHook(scope, scope.beforeAllHook, 'beforeAll');
        }
        ranAny = true;

        await this.runTest(scope, testCase);
      }

      if (ranAny && scope.afterAllHook) {
        await this.runSuiteHook(scope, scope.afterAllHook, 'afterAll');
      }
    }

    const stop = new Date();
    const duration = (stop.getTime() - start.getTime()) / 1000;
    console.log(
      `cavynext test suite stopped at ${stop.toISOString()}, duration: ${duration} seconds.`,
    );

    // Compile the report object. `fullResults` carries the extra metadata the
    // CLI's JUnit formatter needs.
    const report: TestReport = {
      results: this.results,
      fullResults: {
        time: duration,
        timestamp: start.toISOString(),
        testCases: this.results,
      },
      errorCount: this.errorCount,
      duration,
    };

    await this.report(report);
  }

  // Internal: Decide whether a test case should run, based on the `only`
  // filter. With no filter, every test runs.
  private shouldRun(testCase: TestCase): boolean {
    if (!this.filter) {
      return true;
    }
    return testCase.tag !== null && this.filter.includes(testCase.tag);
  }

  // Internal: Report a test case as skipped without running it.
  private skipTest(test: TestCase): void {
    const description = `${test.describeLabel}: ${test.label}`;
    const message = `${description}  ⏭ (skipped)`;
    console.log(message);

    this.results.push({
      describeLabel: test.describeLabel,
      description,
      message,
      passed: true,
      skipped: true,
      time: 0,
    });

    this.sendSingleResult({ message, passed: true });
  }

  // Internal: Run a suite-level hook (`beforeAll`/`afterAll`), reporting any
  // error without aborting the whole run.
  private async runSuiteHook(scope: TestScope, hook: TestFn, name: string): Promise<void> {
    try {
      await hook.call(scope);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn(`cavynext: ${name} hook failed: ${errorMessage}`);
      this.errorCount += 1;
    }
  }

  // Internal: Synchronously runs a single test case, logging whether it passed
  // and adding to the results array for reporting purposes.
  //
  // Order of actions:
  //   1. Clear persisted storage.
  //   2. Re-render the app, so the test starts from a clean tree.
  //   3. Call the suite's `beforeEach` function.
  //   4. Run the test.
  //
  // `beforeEach` has to run *after* the re-render, otherwise the re-mount
  // discards whatever state it just set up - which is its whole purpose.
  async runTest(scope: TestScope, test: TestCase): Promise<void> {
    const start = new Date();

    await this.host.clearStorage();
    // Awaited so the test only starts once the re-mount has committed; the
    // hook store no longer contains components of the previous mount.
    await this.host.reRender();

    const { describeLabel, label, f } = test;
    const description = `${describeLabel}: ${label}`;

    try {
      // Inside the try, so a failing `beforeEach` is reported against this test
      // rather than aborting the whole run and losing the report.
      if (scope.beforeEachHook) {
        await scope.beforeEachHook.call(scope);
      }

      await f.call(scope);

      // A failing `afterEach` fails the test it follows.
      if (scope.afterEachHook) {
        await scope.afterEachHook.call(scope);
      }
      const time = this.elapsed(start);

      const successMsg = `${description}  ✅`;
      console.log(successMsg);

      this.results.push({
        describeLabel,
        description,
        message: successMsg,
        passed: true,
        time,
      });

      this.sendSingleResult({ message: successMsg, passed: true });
    } catch (e) {
      const time = this.elapsed(start);
      const errorMessage = e instanceof Error ? e.message : String(e);

      const fullErrorMessage = `${description}  ❌\n   Caught error: ${errorMessage}`;
      console.warn(fullErrorMessage);

      this.results.push({
        describeLabel,
        description,
        message: fullErrorMessage,
        errorMessage,
        passed: false,
        time,
      });

      this.sendSingleResult({ message: fullErrorMessage, passed: false });

      // Increase error count for reporting.
      this.errorCount += 1;
    }
  }

  // Internal: Stream a single result to the reporter, but only if it is a
  // realtime reporter.
  private sendSingleResult(result: { message: string; passed: boolean }): void {
    if (this.isRealtime(this.reporter)) {
      this.reporter.send(result);
    }
  }

  // Internal: Hand the finished report to whichever style of reporter is
  // configured.
  private async report(report: TestReport): Promise<void> {
    if (typeof this.reporter === 'function') {
      await this.reporter(report);
      return;
    }
    if (this.reporter.type === 'realtime') {
      await this.reporter.onFinish(report);
      return;
    }
    if (this.reporter.type === 'deferred') {
      await this.reporter.send(report);
      return;
    }

    console.log(
      'cavynext: could not find a valid reporter. A reporter must either be a ' +
        "function, or expose a `type` of 'realtime' or 'deferred'.",
    );
  }

  // Internal: Narrow a reporter to the realtime variant.
  private isRealtime(reporter: Reporter): reporter is RealtimeReporter {
    return typeof reporter !== 'function' && reporter.type === 'realtime';
  }

  // Internal: Seconds elapsed since `start`.
  private elapsed(start: Date): number {
    return (Date.now() - start.getTime()) / 1000;
  }

  // Internal: Pauses the test runner for a length of time.
  async pause(time: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, time);
    });
  }
}
