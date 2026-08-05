import {
  ComponentNotFoundError,
  MissingPropError,
  TimeoutError,
  UnwrappedComponentError,
} from './errors';
import type TestHookStore from './TestHookStore';
import type { HookedComponent, TestCase, TestFn } from './types';

// Internal: How often, in milliseconds, polling helpers re-check a condition.
const POLL_INTERVAL = 100;

// Public: TestScope is responsible for building up the test cases to be run by
// the TestRunner, and includes every function available when writing specs.
//
// A new TestScope is created for each spec file, and is the `spec` argument
// your spec function receives.
//
// testHooks       - the TestHookStore holding the hooked components.
// waitTime        - length of time in ms that we should wait before giving up on
//                   finding a component in the test hook store.
// resolveByTestID - (Optional) fallback used to find a component by its
//                   `testID` prop when it was never hooked explicitly.
export default class TestScope {
  // Internal: Test cases collected from `it` calls, consumed by the TestRunner.
  readonly testCases: TestCase[] = [];

  private readonly testHooks: TestHookStore;
  private readonly waitTime: number;
  private readonly resolveByTestID?: (testID: string) => HookedComponent | undefined;

  // Internal: Label and tag of the `describe` block currently being built up.
  private describeLabel = '';
  private describeTag: string | null = null;

  // Internal: The function registered via `beforeEach`, if any. Kept in a
  // private field rather than assigned onto `this.beforeEach` (as Cavy did),
  // which would clobber the method itself and break a second `beforeEach` call.
  private beforeEachFn?: TestFn;

  constructor(
    testHooks: TestHookStore,
    waitTime: number,
    resolveByTestID?: (testID: string) => HookedComponent | undefined,
  ) {
    this.testHooks = testHooks;
    this.waitTime = waitTime;
    this.resolveByTestID = resolveByTestID;
  }

  // STRUCTURE

  // Public: Build up a group of test cases.
  //
  // label - Label for these test cases.
  // f     - Callback function containing your test cases defined with `it`.
  // tag   - (Optional) A string tag used to determine whether the group of
  //         tests should run. Defaults to null.
  //
  // Example
  //
  //   // specs/MyFeatureSpec.ts
  //   export default function (spec: TestScope) {
  //     spec.describe('My Scene', function () {
  //       spec.it('has a component', async function () {
  //         await spec.exists('MyScene.myComponent');
  //       }, 'focus');
  //     });
  //   }
  //
  // Returns undefined.
  describe(label: string, f: () => void, tag: string | null = null): void {
    this.describeLabel = label;
    this.describeTag = tag;
    f.call(this);
  }

  // Public: Define a test case.
  //
  // label   - Label for this test case. This is combined with the label from
  //           `describe` when the result is logged.
  // f       - The test case.
  // testTag - (Optional) A string tag used to determine whether the individual
  //           test should run. Inherits the tag of its surrounding `describe`
  //           block when present, otherwise defaults to null.
  //
  // See the example above.
  it(label: string, f: TestFn, testTag: string | null = null): void {
    const tag = this.describeTag ?? testTag;
    this.testCases.push({ describeLabel: this.describeLabel, label, f, tag });
  }

  // Public: Register a function to run before each test case in this spec.
  //
  // f - the function to run.
  beforeEach(f: TestFn): void {
    this.beforeEachFn = f;
  }

  // Internal: The registered `beforeEach` function, read by the TestRunner.
  get beforeEachHook(): TestFn | undefined {
    return this.beforeEachFn;
  }

  // LOOKUP

  // Public: Find a component by its test hook identifier. Waits up to
  // `waitTime` for the component to appear before abandoning.
  //
  // Usually you'll want to use `exists` instead.
  //
  // identifier - String, component identifier registered in the test hook
  //              store via `generateTestHook`.
  //
  // Example
  //
  //   const c = await spec.findComponent('MyScene.myComponent');
  //
  // Returns a promise; use `await` when calling this function. Resolves with
  // the component if it is found, rejects with a ComponentNotFoundError after
  // `waitTime` if the component never appears in the test hook store.
  findComponent(identifier: string): Promise<HookedComponent> {
    return new Promise<HookedComponent>((resolve, reject) => {
      // Check straight away. Most lookups are for a component that is already
      // hooked, and polling first would make every one of them wait a full
      // interval for no reason.
      const existing = this.lookup(identifier);
      if (existing) {
        resolve(existing);
        return;
      }

      const startTime = Date.now();
      const loop = setInterval(() => {
        const component = this.lookup(identifier);
        if (component) {
          clearInterval(loop);
          resolve(component);
        } else if (Date.now() - startTime >= this.waitTime) {
          clearInterval(loop);
          reject(new ComponentNotFoundError(this.notFoundMessage(identifier)));
        }
      }, POLL_INTERVAL);
    });
  }

  // Internal: Resolve an identifier to a component.
  //
  // Explicitly hooked components win, so that adding a `testID` somewhere can
  // never change the meaning of an existing spec.
  private lookup(identifier: string): HookedComponent | undefined {
    return this.testHooks.get(identifier) ?? this.resolveByTestID?.(identifier);
  }

  // Internal: Build the "not found" message, listing what *is* available so the
  // usual cause - a typo - is obvious.
  private notFoundMessage(identifier: string): string {
    const hooked = this.testHooks.identifiers().join(', ') || '(none)';
    const fallback = this.resolveByTestID
      ? ' No component with a matching `testID` was found either.'
      : '';

    return (
      `Could not find component with identifier ${identifier}. ` +
      `Hooked identifiers: ${hooked}.${fallback}`
    );
  }

  // ACTIONS

  // Public: Fill in a `TextInput`-compatible component with a string value.
  // Your component should respond to the property `onChangeText`.
  //
  // identifier - Identifier for the component.
  // str        - String to fill in.
  //
  // Returns a promise; use `await` when calling this function. The promise is
  // rejected if the component is not found.
  async fillIn(identifier: string, str: string): Promise<void> {
    const props = await this.propsOf(identifier, 'fillIn');
    this.callProp(props, 'onChangeText', identifier)(str);
  }

  // Public: Alias of `fillIn`, named after the prop it calls.
  async changeText(identifier: string, str: string): Promise<void> {
    return this.fillIn(identifier, str);
  }

  // Public: 'Press' a component (e.g. a `<Button />`).
  // Your component should respond to the property `onPress`.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async press(identifier: string): Promise<void> {
    const props = await this.propsOf(identifier, 'press');
    this.callProp(props, 'onPress', identifier)();
  }

  // Public: 'Long press' a component.
  // Your component should respond to the property `onLongPress`.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async longPress(identifier: string): Promise<void> {
    const props = await this.propsOf(identifier, 'longPress');
    this.callProp(props, 'onLongPress', identifier)();
  }

  // Public: 'Focus' a component (e.g. a `<TextInput />`).
  // Your component should respond to the property `onFocus`.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async focus(identifier: string): Promise<void> {
    const props = await this.propsOf(identifier, 'focus');
    this.callProp(props, 'onFocus', identifier)();
  }

  // Public: Scroll a scrollable component to a given content offset.
  //
  // Prefers the imperative `scrollTo` method exposed by `ScrollView` and
  // `FlatList`; falls back to invoking `onScroll` with a synthetic native
  // event, which is what a plain hooked component will respond to.
  //
  // identifier - Identifier for the component.
  // offset     - `{ x, y }` content offset to scroll to. Missing axes are 0.
  //
  // Returns a promise; use `await` when calling this function.
  async scrollTo(identifier: string, offset: { x?: number; y?: number }): Promise<void> {
    const component = await this.findComponent(identifier);
    const contentOffset = { x: offset.x ?? 0, y: offset.y ?? 0 };

    if (typeof component.scrollTo === 'function') {
      component.scrollTo({ ...contentOffset, animated: false });
      return;
    }

    const props = this.assertProps(component, identifier, 'scrollTo');
    this.callProp(props, 'onScroll', identifier)({ nativeEvent: { contentOffset } });
  }

  // Public: Pause the test for a specified length of time, perhaps to allow
  // time for a request response to be received.
  //
  // time - Integer length of time to pause for (in milliseconds).
  //
  // Returns a promise; use `await` when calling this function.
  async pause(time: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, time);
    });
  }

  // Public: Poll a predicate until it returns a truthy value.
  //
  // Useful when what you're waiting for isn't the presence of a component,
  // e.g. waiting for a hooked component's prop to take a certain value.
  //
  // predicate - Function returning a boolean, or a promise of one. Errors it
  //             throws are swallowed so that "not there yet" is not a failure.
  // timeout   - (Optional) How long to keep polling, in ms. Defaults to the
  //             Tester's `waitTime`.
  //
  // Returns a promise; rejects with a TimeoutError if the predicate never
  // becomes truthy.
  async waitFor(
    predicate: () => boolean | Promise<boolean>,
    timeout: number = this.waitTime,
  ): Promise<void> {
    const startTime = Date.now();

    for (;;) {
      try {
        if (await predicate()) {
          return;
        }
      } catch {
        // Swallowed on purpose: the condition may not be evaluable yet.
      }

      if (Date.now() - startTime >= timeout) {
        throw new TimeoutError(`Timed out after ${timeout}ms waiting for condition`);
      }

      await this.pause(POLL_INTERVAL);
    }
  }

  // ASSERTIONS

  // Public: Check a component exists.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise resolving to `true`; rejects if the component is never
  // found.
  async exists(identifier: string): Promise<boolean> {
    const component = await this.findComponent(identifier);
    return !!component;
  }

  // Public: Check for the absence of a component. Will potentially halt your
  // test for the full wait time.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise resolving to `true` when the component is absent;
  // rejects if the component is present.
  async notExists(identifier: string): Promise<boolean> {
    try {
      await this.findComponent(identifier);
    } catch (e) {
      if (e instanceof Error && e.name === 'ComponentNotFoundError') {
        return true;
      }
      throw e;
    }
    throw new Error(`Component with identifier ${identifier} was present`);
  }

  // Public: Check that a component is present *and* not hidden by its style.
  //
  // Catches the common case of a component that is mounted but invisible
  // (`display: 'none'`, zero opacity). Only style props are inspected; this is
  // not a real hit test.
  //
  // identifier - Identifier for the component.
  //
  // Returns a promise resolving to `true`; rejects if missing or hidden.
  async expectVisible(identifier: string): Promise<boolean> {
    const props = await this.propsOf(identifier, 'expectVisible');
    const styles = flattenStyle(props.style);

    if (styles.display === 'none') {
      throw new Error(`Component with identifier ${identifier} has display: 'none'`);
    }
    if (styles.opacity === 0) {
      throw new Error(`Component with identifier ${identifier} has opacity: 0`);
    }

    return true;
  }

  // Public: Check whether a component, e.g. `<Text>`, contains the given text
  // string as a child.
  //
  // identifier - Identifier for the component.
  // text       - String the component's children should contain.
  //
  // Returns a promise; rejects if the component is not found, has not been
  // wrapped, or does not contain the text.
  async containsText(identifier: string, text: string): Promise<void> {
    const component = await this.findComponent(identifier);

    if (component.props === undefined) {
      const msg =
        "Cannot read property 'children' of undefined.\n" +
        'Are you using `containsText` with a React <Text> component?\n' +
        'If so, you need to `wrap` the component first.';

      throw new UnwrappedComponentError(msg);
    }

    // `children` may be a string, a number, or an array of nodes; normalise to
    // something with `includes`.
    const children = component.props.children;
    const stringifiedChildren = Array.isArray(children)
      ? children.map((child) => String(child)).join('')
      : String(children);

    if (!stringifiedChildren.includes(text)) {
      throw new Error(`Could not find text ${text}`);
    }
  }

  // INTERNAL HELPERS

  // Internal: Find a component and return its props, failing with a helpful
  // error when the component has not been wrapped.
  private async propsOf(identifier: string, helper: string): Promise<Record<string, any>> {
    const component = await this.findComponent(identifier);
    return this.assertProps(component, identifier, helper);
  }

  // Internal: Assert that a hooked component exposes props.
  private assertProps(
    component: HookedComponent,
    identifier: string,
    helper: string,
  ): Record<string, any> {
    if (!component.props) {
      throw new UnwrappedComponentError(
        `Component with identifier ${identifier} does not expose any props, so ` +
          `\`${helper}\` cannot be used on it. Pass it through \`wrap()\` first.`,
      );
    }
    return component.props;
  }

  // Internal: Return a callable prop, or fail with a clear message naming the
  // prop the component is missing.
  private callProp(
    props: Record<string, any>,
    prop: string,
    identifier: string,
  ): (...args: any[]) => any {
    const fn = props[prop];
    if (typeof fn !== 'function') {
      throw new MissingPropError(
        `Component with identifier ${identifier} does not respond to \`${prop}\``,
      );
    }
    return fn;
  }
}

// Internal: Collapse a React Native style prop (object, array, or nested
// arrays) into a single plain object, mirroring `StyleSheet.flatten` without
// depending on react-native.
function flattenStyle(style: any): Record<string, any> {
  if (!style) {
    return {};
  }
  if (Array.isArray(style)) {
    return style.reduce<Record<string, any>>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }
  return typeof style === 'object' ? style : {};
}
