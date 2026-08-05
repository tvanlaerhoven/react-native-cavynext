// Public: The custom error types thrown by the spec helpers.
//
// They are exported so that you can assert on them in your own specs, and are
// distinguished by `name` (rather than only by class) because errors crossing
// the React Native bridge lose their prototype chain.

// Public: Thrown when a component cannot be found in the TestHookStore within
// the Tester's `waitTime`.
export class ComponentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentNotFoundError';
  }
}

// Public: Thrown when a helper is used on a component whose props are not
// reachable, which happens when a host component such as `<Text>` has not been
// passed through `wrap`.
export class UnwrappedComponentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnwrappedComponentError';
  }
}

// Public: Thrown when a component is found but does not implement the prop a
// helper needs, e.g. calling `press` on something without `onPress`.
export class MissingPropError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingPropError';
  }
}

// Public: Thrown when `waitFor` gives up waiting for its predicate.
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
