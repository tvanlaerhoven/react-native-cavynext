import React from 'react';
import { act, create } from 'react-test-renderer';
import { Tester, TestHookStore, type SpecFn, type TestReport } from 'react-native-cavynext';

import App from '../App';
import PlainApp from '../PlainApp';
import loginSpec from '../../specs/loginSpec';
import testIDSpec from '../../specs/testIDSpec';
import welcomeSpec from '../../specs/welcomeSpec';

// Mounts the app inside a real <Tester> and resolves with the report.
//
// In a real project the CLI plays this role: it boots the app and collects the
// report over a websocket. Here a function reporter stands in for it, so the
// same specs run in Jest with no simulator.
async function runSpecs(
  specs: SpecFn[],
  children: React.ReactElement = <App />,
): Promise<TestReport> {
  let resolveReport: (report: TestReport) => void;
  const reportPromise = new Promise<TestReport>((resolve) => {
    resolveReport = resolve;
  });

  await act(async () => {
    create(
      <Tester
        specs={specs}
        store={new TestHookStore()}
        reporter={(report: TestReport) => resolveReport(report)}
        // Kept short so the `notExists` assertions, which always wait the full
        // time, don't slow the suite down.
        waitTime={200}
      >
        {children}
      </Tester>,
    );

    // Awaited inside `act` so the re-renders the runner triggers between test
    // cases are all flushed.
    await reportPromise;
  });

  return reportPromise;
}

describe('the headless example app', () => {
  // The runner logs each result, and warns on failures, which would drown out
  // Jest's own output.
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes every spec', async () => {
    const report = await runSpecs([loginSpec, welcomeSpec]);

    // Surface the actual failure messages, rather than just a count.
    const failures = report.results
      .filter((result) => !result.passed)
      .map((result) => `${result.description}: ${result.errorMessage}`);

    expect(failures).toEqual([]);
    expect(report.errorCount).toBe(0);
    expect(report.results).toHaveLength(9);
  });

  it('drives an app that contains no cavynext code, via testID', async () => {
    const report = await runSpecs([testIDSpec], <PlainApp />);

    const failures = report.results
      .filter((result) => !result.passed)
      .map((result) => `${result.description}: ${result.errorMessage}`);

    expect(failures).toEqual([]);
    expect(report.results).toHaveLength(4);
  });

  it('prefers an explicitly hooked component over a matching testID', async () => {
    // LoginScreen hooks `LoginScreen.Title` with the text 'Log in', while
    // PlainApp exposes a `SignUp.Title` testID. Hooks must win for any
    // identifier present in both, so adding a testID can never silently change
    // what an existing spec means.
    const precedenceSpec: SpecFn = (spec) => {
      spec.describe('Precedence', () => {
        spec.it('resolves the hooked component', async () => {
          await spec.containsText('LoginScreen.Title', 'Log in');
        });
      });
    };

    const report = await runSpecs([precedenceSpec]);

    expect(report.errorCount).toBe(0);
  });

  it('reports a failing spec without taking the whole run down', async () => {
    // Proves failures are reported rather than thrown, which is what lets the
    // CLI report every result and still exit non-zero.
    const failingSpec: SpecFn = (spec) => {
      spec.describe('A broken expectation', () => {
        spec.it('fails', async () => {
          await spec.containsText('LoginScreen.Title', 'Sign up');
        });
        spec.it('still runs the next test case', async () => {
          await spec.exists('LoginScreen');
        });
      });
    };

    const report = await runSpecs([failingSpec]);

    expect(report.errorCount).toBe(1);
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].errorMessage).toMatch(/Could not find text/);
    expect(report.results[1].passed).toBe(true);
  });
});
