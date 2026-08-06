import React, { Children, Component, type ReactNode } from 'react';

import { createSelectorResolver, createTestIDResolver } from './findByTestID';
import TestHookStore from './TestHookStore';
import TestRunner from './TestRunner';
import TestScope from './TestScope';
import WebSocketReporter from './WebSocketReporter';
import type {
  Reporter,
  ReporterConstructor,
  SpecFn,
  Storage,
  TestHost,
  RealtimeReporter,
} from './types';

// Public: The context through which hooked components reach the test hook
// store. Consumed by `hook()` and `useCavyNext()`.
//
// It is `undefined` when the app is not wrapped in a `<Tester>`, which is
// exactly what happens in production builds - hooking then becomes a no-op.
export const TesterContext = React.createContext<TestHookStore | undefined>(undefined);

// Public: Props accepted by the `<Tester>` component.
export interface TesterProps {
  // An instance of TestHookStore.
  store: TestHookStore;
  // An array of spec functions.
  specs: SpecFn[];
  // The app under test.
  children: ReactNode;
  // A reporter instance, a reporter class, or a function called with the test
  // report. Defaults to WebSocketReporter, which sends results to
  // react-native-cavynext-cli.
  reporter?: Reporter | ReporterConstructor;
  // Time in milliseconds that `findComponent` waits for a component to appear.
  // Defaults to 2000.
  waitTime?: number;
  // Time in milliseconds to wait before test execution begins. Defaults to 0.
  startDelay?: number;
  // Only run test cases whose tag is in this array. Runs everything when
  // omitted.
  only?: string[];
  // Whether to clear `storage` between each test case. Defaults to false.
  clearStorage?: boolean;
  // Your AsyncStorage implementation, required when `clearStorage` is true.
  // Cavy imported AsyncStorage from react-native, which no longer exists;
  // inject it instead.
  storage?: Storage;
  // Deprecated: Cavy's name for `clearStorage`. Accepted so an existing Tester
  // keeps working during a migration; pass `storage` alongside it.
  clearAsyncStorage?: boolean;
  // Deprecated and ignored: Cavy used this to decide whether to send a report.
  // Reporting now depends only on whether the CLI is listening.
  sendReport?: boolean;
  // Whether specs may identify components by their `testID` prop when they were
  // never hooked with `generateTestHook`. Defaults to true.
  //
  // This is what allows an app to be tested without any cavynext code in its
  // components. Explicitly hooked components always take precedence.
  useTestIDs?: boolean;
}

interface TesterState {
  // Changing this key re-mounts the app under test between test cases.
  key: number;
}

// Public: Wrap your entire app in `<Tester>` to run tests against it,
// interacting with registered components in your test cases via the spec
// helpers defined in TestScope.
//
// This component provides the test hook store to the tree below it, so hooked
// components can register themselves.
//
// Example
//
//   import { Tester, TestHookStore } from 'react-native-cavynext';
//
//   import MyFeatureSpec from './specs/MyFeatureSpec';
//   import OtherFeatureSpec from './specs/OtherFeatureSpec';
//
//   const testHookStore = new TestHookStore();
//
//   export default function AppWrapper() {
//     return (
//       <Tester specs={[MyFeatureSpec, OtherFeatureSpec]} store={testHookStore}>
//         <App />
//       </Tester>
//     );
//   }
//
export default class Tester extends Component<TesterProps, TesterState> implements TestHost {
  private readonly testHookStore: TestHookStore;
  private readonly reporter: Reporter;

  constructor(props: TesterProps) {
    super(props);
    this.state = { key: Math.random() };
    this.testHookStore = props.store;
    this.reporter = resolveReporter(props.reporter);
  }

  override componentDidMount(): void {
    if (this.props.sendReport !== undefined) {
      console.warn(
        'cavynext: the `sendReport` prop is deprecated and ignored. A report is ' +
          'sent whenever the CLI report server is listening.',
      );
    }

    // Realtime reporters get a chance to open their connection before any test
    // output is produced.
    if (isRealtime(this.reporter)) {
      this.reporter.onStart();
    }
    void this.runTests();
  }

  // Internal: Build a TestScope per spec file and run them all.
  async runTests(): Promise<void> {
    const { specs, waitTime = 2000, startDelay = 0, only, useTestIDs = true } = this.props;

    // Rooted at this component's own fiber, so only the app under test is
    // searched.
    const getRootFiber = () => (this as any)._reactInternals;
    const resolveByTestID = useTestIDs ? createTestIDResolver(getRootFiber) : undefined;
    const resolveSelector = createSelectorResolver(getRootFiber);

    const testSuites: TestScope[] = [];
    // Iterate over each spec and create a new TestScope for each.
    for (const spec of specs) {
      const scope = new TestScope(this.testHookStore, waitTime, resolveByTestID, resolveSelector);
      await spec(scope);
      testSuites.push(scope);
    }

    // Instantiate the test runner with the test suites, the startDelay to
    // apply, the reporter to use, and the `only` filter to apply.
    const runner = new TestRunner(this, testSuites, startDelay, this.reporter, only);

    await runner.run();
  }

  // Internal: Re-mount the app under test so each test case starts fresh.
  // Resolves once React has committed the re-mount, so a test can never grab
  // hooked components left over from the previous mount.
  reRender(): Promise<void> {
    return new Promise((resolve) => {
      this.setState({ key: Math.random() }, resolve);
    });
  }

  // Internal: Clear everything from the injected storage, warning if anything
  // goes wrong. A no-op unless `clearStorage` is set.
  async clearStorage(): Promise<void> {
    const { clearStorage, clearAsyncStorage, storage } = this.props;

    if (!clearStorage && !clearAsyncStorage) {
      return;
    }
    if (!storage) {
      console.warn(
        'cavynext: `clearStorage` is set but no `storage` prop was provided. ' +
          'Pass your AsyncStorage implementation to <Tester storage={...} />.',
      );
      return;
    }

    try {
      const keys = await storage.getAllKeys();
      await storage.multiRemove(keys);
    } catch (e) {
      console.warn('cavynext: failed to clear storage:', e);
    }
  }

  override render(): ReactNode {
    return (
      <TesterContext.Provider key={this.state.key} value={this.testHookStore}>
        {Children.only(this.props.children)}
      </TesterContext.Provider>
    );
  }
}

// Internal: Turn the `reporter` prop into a usable reporter.
//
// Accepts an instance, a class, or a plain report function, so that all of
// Cavy's documented usages keep working.
function resolveReporter(reporter?: Reporter | ReporterConstructor): Reporter {
  if (!reporter) {
    return new WebSocketReporter();
  }

  if (typeof reporter === 'function') {
    // A reporter class is a function too. Constructors are told apart by
    // whether their prototype carries the reporter interface.
    const prototype = (reporter as ReporterConstructor).prototype;
    if (
      prototype &&
      (typeof prototype.send === 'function' || typeof prototype.onFinish === 'function')
    ) {
      return new (reporter as ReporterConstructor)();
    }
    // Otherwise it is a plain function reporter, called with the final report.
    return reporter as Reporter;
  }

  return reporter;
}

// Internal: Narrow a reporter to the realtime variant.
function isRealtime(reporter: Reporter): reporter is RealtimeReporter {
  return typeof reporter !== 'function' && reporter.type === 'realtime';
}
