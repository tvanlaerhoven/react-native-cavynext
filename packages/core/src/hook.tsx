import React, { Component, type ComponentType } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { TesterContext } from './Tester';
import generateTestHook, { type GenerateTestHook } from './generateTestHook';

// Public: The prop injected into components wrapped with `hook()`.
export interface WithTestHook {
  generateTestHook: GenerateTestHook;
}

// Public: Higher-order component to facilitate adding hooks to the test hook
// store. Once you've hooked your component, set an inner component's ref with
// `this.props.generateTestHook` to add it to the store for later use in a spec.
//
// React calls the generated ref function twice during the render lifecycle:
// once to 'unset' the ref, and once to set it.
//
// WrappedComponent - Component to be wrapped. It is passed a prop called
//                    `generateTestHook`, a function generator that adds a
//                    component to the test hook store.
//
// Example
//
//   import { hook } from 'react-native-cavynext';
//
//   class MyComponent extends React.Component {
//     render() {
//       const { generateTestHook } = this.props;
//       return (
//         <View>
//           <TextInput ref={generateTestHook('MyComponent.textinput')} />
//           <Button ref={generateTestHook('MyComponent.button')} title="Press me!" />
//         </View>
//       );
//     }
//   }
//
//   export default hook(MyComponent);
//
// Returns the new component, with `generateTestHook` supplied as a prop.
export default function hook<P extends WithTestHook>(
  WrappedComponent: ComponentType<P>,
): ComponentType<Omit<P, keyof WithTestHook>> {
  class WrapperComponent extends Component<Omit<P, keyof WithTestHook>> {
    // Reading the test hook store from context, rather than from a prop, is
    // what lets deeply nested components be hooked without prop drilling.
    static override contextType = TesterContext;
    // Declared so it can be assigned below; class expressions do not get an
    // implicit `displayName`.
    static displayName?: string;
    declare context: React.ContextType<typeof TesterContext>;

    override render() {
      // Props are spread first so the injected `generateTestHook` cannot be
      // accidentally overwritten by a prop of the same name.
      return (
        <WrappedComponent
          {...(this.props as P)}
          generateTestHook={generateTestHook(this.context)}
        />
      );
    }
  }

  // Copy all non-React static methods.
  hoistNonReactStatics(WrapperComponent, WrappedComponent);
  // Wrap the display name for easy debugging.
  WrapperComponent.displayName = `Hook(${getDisplayName(WrappedComponent)})`;

  return WrapperComponent;
}

// Internal: Best-effort display name for debugging output.
function getDisplayName(WrappedComponent: ComponentType<any>): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
