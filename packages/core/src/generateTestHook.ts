import type { MutableRefObject } from 'react';

import type TestHookStore from './TestHookStore';
import type { HookedComponent } from './types';

// Public: A ref callback that registers the component it receives in the test
// hook store under `identifier`.
export type TestHookRef = (component: HookedComponent | null) => void;

// Public: The function handed to your components by `useCavyNext()` and by the
// `hook()` higher-order component.
export type GenerateTestHook = (
  identifier: string,
  ref?: TestHookRef | MutableRefObject<any> | null,
) => TestHookRef;

// Public: Returns our `generateTestHook` function, which in turn returns the
// ref generating function that adds components to the testHookStore.
//
// testHookStore - An instance of a TestHookStore, either from `this.context`
//                 when called from a TesterContext consumer, or from
//                 `useContext()` inside our own `useCavyNext()` hook. It is
//                 undefined when the app is *not* wrapped in a `<Tester>`, in
//                 which case hooking is a no-op and only the caller's own ref
//                 is honoured.
export default function generateTestHook(
  testHookStore: TestHookStore | undefined,
): GenerateTestHook {
  // Public: Returns a ref generating function that adds the component itself
  // to the testHookStore for later use in specs.
  //
  // identifier - String, the key the component will be stored under in the
  //              test hook store.
  // ref        - Your own ref callback, or a ref object created via
  //              `createRef`/`useRef` (optional). It is always preserved.
  return function generateTestHookRef(identifier, ref): TestHookRef {
    // Internal: Forwards the component to the caller's own ref, so that
    // hooking a component never steals a ref the app itself relies on.
    const registerRef = (component: HookedComponent | null): void => {
      // Support for callback refs.
      if (typeof ref === 'function') {
        ref(component);
      }
      // Support for `createRef` and `useRef` objects.
      if (ref && typeof ref === 'object') {
        (ref as MutableRefObject<any>).current = component;
      }
    };

    // React calls this twice per render lifecycle: once with `null` to unset
    // the previous ref, and once with the component itself.
    return (component) => {
      if (!testHookStore) {
        return registerRef(component);
      }

      if (component) {
        testHookStore.add(identifier, component);
      } else {
        testHookStore.remove(identifier);
      }

      return registerRef(component);
    };
  };
}
