import TestHookStore from '../TestHookStore';
import TestRunner from '../TestRunner';
import TestScope from '../TestScope';
import type { RealtimeReporter, TestHost, TestReport } from '../types';

// Internal: A TestHost that records the calls the runner makes on it.
function fakeHost(): TestHost & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    clearStorage: async () => {
      calls.push('clearStorage');
    },
    reRender: () => {
      calls.push('reRender');
    },
  };
}

// Internal: Collects the report handed to a function reporter.
function captureReporter() {
  const captured: { report?: TestReport } = {};
  const reporter = (report: TestReport) => {
    captured.report = report;
  };
  return { captured, reporter };
}

function newScope() {
  return new TestScope(new TestHookStore(), 100);
}

describe('TestRunner', () => {
  // Console output is noise in the test log, so it is silenced per test.
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs every test case in order and reports a passing run', async () => {
    const order: string[] = [];
    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it('first', async () => {
        order.push('first');
      });
      spec.it('second', async () => {
        order.push('second');
      });
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [spec], 0, reporter).run();

    expect(order).toEqual(['first', 'second']);
    expect(captured.report?.errorCount).toBe(0);
    expect(captured.report?.results.map((r) => r.description)).toEqual([
      'Suite: first',
      'Suite: second',
    ]);
    expect(captured.report?.results.every((r) => r.passed)).toBe(true);
  });

  it('records failures with their error message and counts them', async () => {
    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it('passes', async () => {});
      spec.it('fails', async () => {
        throw new Error('boom');
      });
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [spec], 0, reporter).run();

    expect(captured.report?.errorCount).toBe(1);
    const failure = captured.report?.results[1];
    expect(failure?.passed).toBe(false);
    expect(failure?.errorMessage).toBe('boom');
    expect(failure?.description).toBe('Suite: fails');
  });

  it('clears storage and re-renders before running beforeEach and the test', async () => {
    const host = fakeHost();
    const spec = newScope();
    spec.beforeEach(async () => {
      host.calls.push('beforeEach');
    });
    spec.describe('Suite', () => {
      spec.it('runs', async () => {
        host.calls.push('test');
      });
    });

    const { reporter } = captureReporter();
    await new TestRunner(host, [spec], 0, reporter).run();

    // `beforeEach` must come after the re-render, or the re-mount would discard
    // the state it just set up.
    expect(host.calls).toEqual(['clearStorage', 'reRender', 'beforeEach', 'test']);
  });

  it('reports a failing beforeEach as a test failure instead of aborting the run', async () => {
    const spec = newScope();
    spec.beforeEach(async () => {
      throw new Error('setup failed');
    });
    spec.describe('Suite', () => {
      spec.it('never gets to run its body', async () => {});
      spec.it('is still attempted', async () => {});
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [spec], 0, reporter).run();

    // The run completed and produced a report, rather than throwing.
    expect(captured.report?.errorCount).toBe(2);
    expect(captured.report?.results).toHaveLength(2);
    expect(captured.report?.results[0].errorMessage).toBe('setup failed');
  });

  it('only runs tests whose tag matches the filter', async () => {
    const ran: string[] = [];
    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it(
        'tagged',
        async () => {
          ran.push('tagged');
        },
        'focus',
      );
      spec.it('untagged', async () => {
        ran.push('untagged');
      });
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [spec], 0, reporter, ['focus']).run();

    expect(ran).toEqual(['tagged']);
    expect(captured.report?.results).toHaveLength(1);
  });

  it('runs suites from multiple spec files', async () => {
    const first = newScope();
    first.describe('First', () => {
      first.it('runs', async () => {});
    });
    const second = newScope();
    second.describe('Second', () => {
      second.it('runs', async () => {});
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [first, second], 0, reporter).run();

    expect(captured.report?.results.map((r) => r.describeLabel)).toEqual(['First', 'Second']);
  });

  it('streams single results to a realtime reporter and finishes with the report', async () => {
    const sent: { message: string; passed: boolean }[] = [];
    let finished: TestReport | undefined;
    const reporter: RealtimeReporter = {
      type: 'realtime',
      onStart: () => {},
      send: (result) => sent.push(result),
      onFinish: (report) => {
        finished = report;
      },
    };

    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it('passes', async () => {});
      spec.it('fails', async () => {
        throw new Error('nope');
      });
    });

    await new TestRunner(fakeHost(), [spec], 0, reporter).run();

    expect(sent.map((r) => r.passed)).toEqual([true, false]);
    expect(finished?.errorCount).toBe(1);
  });

  it('sends the report to a deferred reporter', async () => {
    let received: TestReport | undefined;
    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it('runs', async () => {});
    });

    await new TestRunner(fakeHost(), [spec], 0, {
      type: 'deferred',
      send: (report) => {
        received = report;
      },
    }).run();

    expect(received?.results).toHaveLength(1);
  });

  it('includes aggregated results for the JUnit formatter', async () => {
    const spec = newScope();
    spec.describe('Suite', () => {
      spec.it('runs', async () => {});
    });

    const { captured, reporter } = captureReporter();
    await new TestRunner(fakeHost(), [spec], 0, reporter).run();

    const full = captured.report?.fullResults;
    expect(full?.testCases).toHaveLength(1);
    expect(typeof full?.time).toBe('number');
    expect(typeof full?.timestamp).toBe('string');
  });
});
