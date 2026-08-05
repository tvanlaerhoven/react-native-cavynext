import React, { forwardRef, useImperativeHandle } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

// Public: Make a component's props reachable through its ref, so the spec
// helpers can interact with it via the test hook store.
//
// Two cases are handled:
//
// 1. A function component. It is wrapped in `forwardRef()` and
//    `useImperativeHandle` exposes `{ props }` on the ref. Function components
//    have no instance, so without this there is nothing for a ref to point at.
//
// 2. A host component such as `Text`, which is a plain object rather than a
//    function. React Native's renderer gives refs to these an instance that
//    does not expose props, so we wrap them in a class component that does.
//
// Class components need no wrapping - attach the ref directly - and passing one
// in logs a warning and returns it untouched.
//
// Example, function component
//
//   import { Button } from 'react-native-elements';
//   import { useCavyNext, wrap } from 'react-native-cavynext';
//
//   const TestableButton = wrap(Button);
//
//   export default function Login() {
//     const generateTestHook = useCavyNext();
//     return <TestableButton ref={generateTestHook('Login.Button')} onPress={submit} />;
//   }
//
// Example, host component
//
//   import { Text } from 'react-native';
//   import { useCavyNext, wrap } from 'react-native-cavynext';
//
//   const TestableText = wrap(Text);
//
//   export default function Title({ title }) {
//     const generateTestHook = useCavyNext();
//     return <TestableText ref={generateTestHook('Title.text')}>{title}</TestableText>;
//   }
//
export default function wrap<P extends object>(Component: React.ComponentType<P>): any {
  if (typeof Component === 'function' && isNotReactClass(Component)) {
    // `forwardRef` accepts a render function that receives our props and ref.
    // `useImperativeHandle` then makes the props readable through that ref.
    const Wrapped = forwardRef<{ props: P }, P>((forwardedProps, ref) => {
      // `forwardRef` widens props to `PropsWithoutRef<P>`; the component itself
      // still expects `P`, so narrow it back.
      const props = forwardedProps as P;
      useImperativeHandle(ref, () => ({ props }));
      return (Component as (props: P) => React.ReactElement | null)(props);
    });
    Wrapped.displayName = `Wrap(${getDisplayName(Component)})`;
    return Wrapped;
  }

  if (typeof Component === 'object' && Component !== null) {
    // Host components: render them from inside a class component, whose
    // instance exposes `props` to the ref.
    class WrapperComponent extends React.Component<P> {
      // Declared so it can be assigned below.
      static displayName?: string;

      override render() {
        const Inner = Component as React.ComponentType<P>;
        return <Inner {...this.props} />;
      }
    }
    // Copy all non-React static methods.
    hoistNonReactStatics(WrapperComponent, Component as React.ComponentType<P>);
    // Wrap the display name for easy debugging.
    WrapperComponent.displayName = `Wrap(${getDisplayName(Component)})`;
    return WrapperComponent;
  }

  console.warn(
    "cavynext: looks like you're passing a class component into `wrap` - you " +
      "don't need to do this. Attach a test hook ref to the component itself.",
  );
  return Component;
}

// Internal: React class components are functions too, so an extra check is
// needed. Mirrors the check used inside React's own source.
function isNotReactClass(Component: any): boolean {
  return !(Component.prototype && Component.prototype.isReactComponent);
}

// Internal: Best-effort display name for debugging output.
function getDisplayName(Component: any): string {
  return Component.displayName || Component.name || 'Component';
}
