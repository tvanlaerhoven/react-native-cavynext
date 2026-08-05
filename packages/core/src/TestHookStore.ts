import type { HookedComponent } from './types';

// Public: A TestHookStore stores flattened references to UI components in your
// app that you want to interact with as part of your integration tests.
//
// Create one instance per app and hand it to the `<Tester>` component; see
// Tester.tsx for an example.
export default class TestHookStore {
  // Internal: Flat map of identifier -> component ref.
  private hooks: Record<string, HookedComponent> = {};

  // Internal: Add a new component into the store. If there is an existing
  // component with that identifier, replace it.
  //
  // identifier - String, a unique identifier for this component. To help
  //              separate out hooked components, use dot namespaces e.g.
  //              'MyScene.myComponent'.
  // component  - Component returned by a React `ref` callback.
  //
  // Returns undefined.
  add(identifier: string, component: HookedComponent): void {
    this.hooks[identifier] = component;
  }

  // Internal: Remove a component from the store. Called when React unsets a
  // ref, i.e. when the component unmounts.
  //
  // Returns undefined.
  remove(identifier: string): void {
    delete this.hooks[identifier];
  }

  // Internal: Fetch a component from the store.
  //
  // Returns the component corresponding to the provided identifier, or
  // undefined if it has not been added.
  get(identifier: string): HookedComponent | undefined {
    return this.hooks[identifier];
  }

  // Internal: List every registered identifier. Useful when a spec fails and
  // you want to know what *was* hooked at that moment.
  identifiers(): string[] {
    return Object.keys(this.hooks);
  }
}
