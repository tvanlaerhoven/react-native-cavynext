// Public: Shared type definitions for react-native-cavynext.
//
// The report/wire types in this file are also consumed by
// react-native-cavynext-cli, so that the in-app reporter and the CLI report
// server can never drift apart.

import type TestScope from './TestScope';

// Public: A component reference that has been registered in the TestHookStore.
//
// React gives us whatever the `ref` of the hooked component resolves to: a
// class instance, the object produced by `useImperativeHandle` (see `wrap`),
// or a host component instance. All we require of it is that it *may* expose
// `props`, which is how the spec helpers interact with the component.
export interface HookedComponent {
  props?: Record<string, any>;
  [key: string]: any;
}

// Public: The signature of a single test case, as passed to `spec.it`.
//
// The function is invoked with the TestScope as its `this`, exactly like Cavy,
// so both `spec.exists(...)` and `this.exists(...)` work inside a test.
export type TestFn = (this: TestScope) => void | Promise<void>;

// Public: The signature of a spec file's default export.
//
// Example
//
//   // specs/LoginSpec.ts
//   import type { SpecFn } from 'react-native-cavynext';
//
//   const spec: SpecFn = (spec) => {
//     spec.describe('Logging in', () => {
//       spec.it('works', async () => {
//         await spec.exists('LoginScreen');
//       });
//     });
//   };
//
//   export default spec;
export type SpecFn = (spec: TestScope) => void | Promise<void>;

// Internal: A single test case, built up by `describe`/`it` on the TestScope
// and executed later by the TestRunner.
export interface TestCase {
  // The label of the surrounding `describe` block.
  describeLabel: string;
  // The label passed to `it`.
  label: string;
  // The test body.
  f: TestFn;
  // Optional tag used by the Tester's `only` filter.
  tag: string | null;
}

// Public: The result of running a single test case.
export interface TestResult {
  describeLabel: string;
  description: string;
  message: string;
  // Only present when the test failed.
  errorMessage?: string;
  passed: boolean;
  // Duration of the test case in seconds.
  time: number;
}

// Public: The aggregated results of a whole run, in the shape the JUnit
// formatter expects.
export interface FullResults {
  // Duration of the whole run in seconds.
  time: number;
  timestamp: string;
  testCases: TestResult[];
}

// Public: The report handed to a reporter once every test has finished.
export interface TestReport {
  results: TestResult[];
  fullResults: FullResults;
  errorCount: number;
  duration: number;
}

// Public: A pass/fail summary for a single test, streamed to realtime
// reporters while the suite is still running.
export interface SingleResult {
  message: string;
  passed: boolean;
}

// Public: A console message forwarded from the app to a realtime reporter.
export interface LogMessage {
  message: string;
  level: 'log' | 'debug' | 'warn' | 'error';
}

// Public: The websocket protocol between the in-app reporter and the CLI's
// report server. Discriminated on `event` so both sides stay in sync.
export type ReportEvent =
  | { event: 'notify'; data: Record<string, never> }
  | { event: 'message'; data: LogMessage }
  | { event: 'singleResult'; data: SingleResult }
  | { event: 'testingComplete'; data: TestReport };

// Public: A reporter that receives results as the suite progresses. This is
// what the default WebSocketReporter implements.
export interface RealtimeReporter {
  type: 'realtime';
  // Called once, when the Tester mounts.
  onStart(): void;
  // Called after every test case.
  send(result: SingleResult): void;
  // Called once, when every test case has finished.
  onFinish(report: TestReport): void | Promise<void>;
}

// Public: A reporter that only receives the final report.
export interface DeferredReporter {
  type: 'deferred';
  send(report: TestReport): void | Promise<void>;
}

// Public: The simplest reporter: a plain function receiving the final report.
export type ReporterFn = (report: TestReport) => void | Promise<void>;

// Public: Anything that can be passed to the Tester's `reporter` prop as an
// already constructed value.
export type Reporter = RealtimeReporter | DeferredReporter | ReporterFn;

// Public: A reporter class. The Tester instantiates it for you, which keeps
// the `<Tester reporter={MyReporter} />` usage from Cavy working.
export type ReporterConstructor = new () => RealtimeReporter | DeferredReporter;

// Public: The subset of AsyncStorage that the Tester needs in order to clear
// persisted state between test cases.
//
// Cavy imported `AsyncStorage` from `react-native`, which was removed from
// core in React Native 0.59. Instead, pass your storage implementation in:
//
//   import AsyncStorage from '@react-native-async-storage/async-storage';
//   <Tester store={store} specs={specs} clearStorage storage={AsyncStorage} />
export interface Storage {
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

// Internal: The contract the TestRunner needs from the Tester component.
// Declared as an interface so the runner can be unit tested without React.
export interface TestHost {
  // Clears persisted storage between test cases, if configured to do so.
  clearStorage(): Promise<void>;
  // Re-mounts the app under test so each test case starts from a clean tree.
  reRender(): void;
}
