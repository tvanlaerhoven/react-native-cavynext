// Public: The react-native-cavynext entry point.
//
// Named exports are the recommended way to consume the library; a default
// aggregate object is also exported so that `import Cavynext from
// 'react-native-cavynext'` works, mirroring Cavy's module shape.

import Tester, { TesterContext, type TesterProps } from './Tester';
import TestHookStore from './TestHookStore';
import TestScope, { type WaitForOptions } from './TestScope';
import TestRunner from './TestRunner';
import WebSocketReporter, { type WebSocketReporterOptions } from './WebSocketReporter';
import ComponentExpectation from './ComponentExpectation';
import by, { type ComponentIdentifier, type Selector } from './by';
import expect, {
  AssertionError,
  type AsyncMatchers,
  type Expectation,
  type Matchers,
} from './expect';
import hook, { type WithTestHook } from './hook';
import useCavyNext from './useCavyNext';
import wrap from './wrap';
import generateTestHook, { type GenerateTestHook, type TestHookRef } from './generateTestHook';

export {
  ComponentNotFoundError,
  MissingPropError,
  TimeoutError,
  UnwrappedComponentError,
} from './errors';

export type {
  DeferredReporter,
  FullResults,
  HookedComponent,
  LogMessage,
  RealtimeReporter,
  ReportEvent,
  Reporter,
  ReporterConstructor,
  ReporterFn,
  SingleResult,
  SpecFn,
  Storage,
  TestCase,
  TestFn,
  TestHost,
  TestReport,
  TestResult,
} from './types';

export type {
  AsyncMatchers,
  ComponentIdentifier,
  Expectation,
  GenerateTestHook,
  Matchers,
  Selector,
  TestHookRef,
  TesterProps,
  WaitForOptions,
  WebSocketReporterOptions,
  WithTestHook,
};

export {
  AssertionError,
  ComponentExpectation,
  Tester,
  TesterContext,
  TestHookStore,
  TestRunner,
  TestScope,
  WebSocketReporter,
  by,
  expect,
  generateTestHook,
  hook,
  useCavyNext,
  wrap,
};

// Public: Alias kept so specs and components ported from Cavy keep working
// without a rename.
export const useCavy = useCavyNext;

const Cavynext = {
  Tester,
  TesterContext,
  TestHookStore,
  TestRunner,
  TestScope,
  WebSocketReporter,
  by,
  expect,
  generateTestHook,
  hook,
  useCavy: useCavyNext,
  useCavyNext,
  wrap,
};

export default Cavynext;
