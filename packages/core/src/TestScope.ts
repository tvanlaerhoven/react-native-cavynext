import { describeIdentifier, isSelector, type ComponentIdentifier, type Selector } from './by';
import ComponentExpectation, { flattenStyle } from './ComponentExpectation';
import {
  ComponentNotFoundError,
  MissingPropError,
  TimeoutError,
  UnwrappedComponentError,
} from './errors';
import type TestHookStore from './TestHookStore';
import type { HookedComponent, TestCase, TestFn } from './types';

// Internal: How often, in milliseconds, polling helpers re-check a condition.
const DEFAULT_POLL_INTERVAL = 100;

// Public: Options accepted by `waitFor` and `waitForElementToBeRemoved`.
export interface WaitForOptions {
  // How long to keep polling, in ms. Defaults to the Tester's `waitTime`.
  timeout?: number;
  // How often to re-check, in ms. Defaults to 100.
  interval?: number;
}

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
// resolveSelector - (Optional) resolver used by the `by.*` selectors.
export default class TestScope {
  // Internal: Test cases collected from `it` calls, consumed by the TestRunner.
  readonly testCases: TestCase[] = [];

  private readonly testHooks: TestHookStore;
  private readonly waitTime: number;
  private readonly resolveByTestID?: (testID: string) => HookedComponent | undefined;
  private readonly resolveSelector?: (selector: Selector) => HookedComponent | undefined;

  // Internal: Labels of the `describe` blocks currently being built up.
  // Supports nesting; the effective label is the stack joined with ' > '.
  private readonly describeStack: string[] = [];
  // Internal: Modes of the `describe` blocks currently being built up.
  private readonly modeStack: ('normal' | 'skip' | 'focus')[] = [];
  // Internal: Tags of the `describe` blocks currently being built up.
  private readonly tagStack: (string | null)[] = [];

  // Internal: Lifecycle hooks registered by this spec, read by the TestRunner.
  private readonly beforeEachFns: TestFn[] = [];
  private readonly afterEachFns: TestFn[] = [];
  private readonly beforeAllFns: TestFn[] = [];
  private readonly afterAllFns: TestFn[] = [];

  constructor(
    testHooks: TestHookStore,
    waitTime: number,
    resolveByTestID?: (testID: string) => HookedComponent | undefined,
    resolveSelector?: (selector: Selector) => HookedComponent | undefined,
  ) {
    this.testHooks = testHooks;
    this.waitTime = waitTime;
    this.resolveByTestID = resolveByTestID;
    this.resolveSelector = resolveSelector;
  }

  // STRUCTURE

  // Public: Build up a group of test cases. `describe` blocks may be nested.
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
  //       });
  //     });
  //   }
  //
  // Returns undefined.
  describe(label: string, f: () => void, tag: string | null = null): void {
    this.pushDescribe(label, 'normal', tag, f);
  }

  // Public: Skip an entire `describe` block. Its tests are reported as
  // skipped rather than run.
  xdescribe(label: string, f: () => void, tag: string | null = null): void {
    this.pushDescribe(label, 'skip', tag, f);
  }

  // Public: Focus an entire `describe` block. When any test or block is
  // focused, only focused tests run.
  fdescribe(label: string, f: () => void, tag: string | null = null): void {
    this.pushDescribe(label, 'focus', tag, f);
  }

  // Internal: Run a describe body with its label/mode/tag pushed on the
  // stacks.
  private pushDescribe(
    label: string,
    mode: 'normal' | 'skip' | 'focus',
    tag: string | null,
    f: () => void,
  ): void {
    this.describeStack.push(label);
    this.modeStack.push(mode);
    this.tagStack.push(tag);
    try {
      f.call(this);
    } finally {
      this.describeStack.pop();
      this.modeStack.pop();
      this.tagStack.pop();
    }
  }

  // Public: Define a test case.
  //
  // label   - Label for this test case. This is combined with the labels from
  //           the surrounding `describe` blocks when the result is logged.
  // f       - The test case.
  // testTag - (Optional) A string tag used to determine whether the individual
  //           test should run. Inherits the tag of its surrounding `describe`
  //           block when present, otherwise defaults to null.
  //
  // See the example above.
  it(label: string, f: TestFn, testTag: string | null = null): void {
    this.pushTest(label, f, testTag, 'normal');
  }

  // Public: Skip a test case. It is reported as skipped rather than run.
  xit(label: string, f: TestFn, testTag: string | null = null): void {
    this.pushTest(label, f, testTag, 'skip');
  }

  // Public: Focus a test case. When any test is focused, only focused tests
  // run.
  fit(label: string, f: TestFn, testTag: string | null = null): void {
    this.pushTest(label, f, testTag, 'focus');
  }

  // Internal: Record a test case with the effective label, tag, and mode of
  // its surrounding blocks.
  private pushTest(
    label: string,
    f: TestFn,
    testTag: string | null,
    mode: 'normal' | 'skip' | 'focus',
  ): void {
    const describeTag = [...this.tagStack].reverse().find((tag) => tag !== null) ?? null;
    const skipped = mode === 'skip' || this.modeStack.includes('skip');
    const focused = mode === 'focus' || this.modeStack.includes('focus');

    this.testCases.push({
      describeLabel: this.describeStack.join(' > '),
      label,
      f,
      tag: describeTag ?? testTag,
      skipped,
      focused,
    });
  }

  // Public: Register a function to run before each test case in this spec.
  // May be called multiple times; functions run in registration order.
  //
  // f - the function to run.
  beforeEach(f: TestFn): void {
    this.beforeEachFns.push(f);
  }

  // Public: Register a function to run after each test case in this spec.
  afterEach(f: TestFn): void {
    this.afterEachFns.push(f);
  }

  // Public: Register a function to run once, before this spec's first test.
  beforeAll(f: TestFn): void {
    this.beforeAllFns.push(f);
  }

  // Public: Register a function to run once, after this spec's last test.
  afterAll(f: TestFn): void {
    this.afterAllFns.push(f);
  }

  // Internal: The registered `beforeEach` functions composed into one, read by
  // the TestRunner. Kept as a single function for backwards compatibility.
  get beforeEachHook(): TestFn | undefined {
    return this.compose(this.beforeEachFns);
  }

  // Internal: The registered `afterEach` functions, read by the TestRunner.
  get afterEachHook(): TestFn | undefined {
    return this.compose(this.afterEachFns);
  }

  // Internal: The registered `beforeAll` functions, read by the TestRunner.
  get beforeAllHook(): TestFn | undefined {
    return this.compose(this.beforeAllFns);
  }

  // Internal: The registered `afterAll` functions, read by the TestRunner.
  get afterAllHook(): TestFn | undefined {
    return this.compose(this.afterAllFns);
  }

  // Internal: Compose a list of hook functions into one that runs them in
  // order.
  private compose(fns: TestFn[]): TestFn | undefined {
    if (fns.length === 0) {
      return undefined;
    }
    return async () => {
      for (const fn of fns) {
        await fn.call(this);
      }
    };
  }

  // PLATFORM

  // Public: The platform the app under test is running on: 'ios', 'android',
  // 'web', or whatever `Platform.OS` reports. Returns 'unknown' when
  // react-native is not resolvable (e.g. in plain unit tests).
  //
  // Example
  //
  //   if (spec.platform() === 'web') { ... }
  platform(): string {
    try {
      // Resolved lazily so this module never hard-depends on react-native.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Platform } = require('react-native');
      return Platform?.OS ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // LOOKUP

  // Public: Find a component by its test hook identifier or a `by.*`
  // selector. Waits up to `waitTime` for the component to appear before
  // abandoning.
  //
  // Usually you'll want to use `exists` instead.
  //
  // identifier - String identifier registered via `generateTestHook`, or a
  //              selector such as `by.text('Hello')`.
  //
  // Example
  //
  //   const c = await spec.findComponent('MyScene.myComponent');
  //   const d = await spec.findComponent(by.label('Close'));
  //
  // Returns a promise; use `await` when calling this function. Resolves with
  // the component if it is found, rejects with a ComponentNotFoundError after
  // `waitTime` if the component never appears.
  findComponent(identifier: ComponentIdentifier): Promise<HookedComponent> {
    return new Promise<HookedComponent>((resolve, reject) => {
      // Check straight away. Most lookups are for a component that is already
      // there, and polling first would make every one of them wait a full
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
      }, DEFAULT_POLL_INTERVAL);
    });
  }

  // Internal: Resolve an identifier to a component.
  //
  // Explicitly hooked components win, so that adding a `testID` somewhere can
  // never change the meaning of an existing spec.
  private lookup(identifier: ComponentIdentifier): HookedComponent | undefined {
    if (isSelector(identifier)) {
      // `by.id` also consults the hook store, so an identifier keeps working
      // regardless of how the component was registered.
      if (identifier.kind === 'id' && typeof identifier.value === 'string') {
        const hooked = this.testHooks.get(identifier.value);
        if (hooked) {
          return hooked;
        }
      }
      return this.resolveSelector?.(identifier);
    }
    return this.testHooks.get(identifier) ?? this.resolveByTestID?.(identifier);
  }

  // Internal: Build the "not found" message, listing what *is* available so the
  // usual cause - a typo - is obvious.
  private notFoundMessage(identifier: ComponentIdentifier): string {
    const hooked = this.testHooks.identifiers().join(', ') || '(none)';
    const fallback =
      this.resolveByTestID || this.resolveSelector
        ? ' No component matching it was found in the rendered tree either.'
        : '';

    return (
      `Could not find component with identifier ${describeIdentifier(identifier)}. ` +
      `Hooked identifiers: ${hooked}.${fallback}`
    );
  }

  // ACTIONS

  // Public: Fill in a `TextInput`-compatible component with a string value.
  // Your component should respond to the property `onChangeText`.
  //
  // identifier - Identifier or selector for the component.
  // str        - String to fill in.
  //
  // Returns a promise; use `await` when calling this function. The promise is
  // rejected if the component is not found.
  async fillIn(identifier: ComponentIdentifier, str: string): Promise<void> {
    const props = await this.propsOf(identifier, 'fillIn');
    this.callProp(props, 'onChangeText', identifier)(str);
  }

  // Public: Alias of `fillIn`, named after the prop it calls.
  async changeText(identifier: ComponentIdentifier, str: string): Promise<void> {
    return this.fillIn(identifier, str);
  }

  // Public: Alias of `fillIn`, replacing whatever text is currently there.
  async replaceText(identifier: ComponentIdentifier, str: string): Promise<void> {
    return this.fillIn(identifier, str);
  }

  // Public: Append text to a `TextInput`-compatible component, keeping its
  // current `value`.
  //
  // identifier - Identifier or selector for the component.
  // str        - String to type.
  //
  // Returns a promise; use `await` when calling this function.
  async typeText(identifier: ComponentIdentifier, str: string): Promise<void> {
    const props = await this.propsOf(identifier, 'typeText');
    const current = typeof props.value === 'string' ? props.value : '';
    this.callProp(props, 'onChangeText', identifier)(current + str);
  }

  // Public: Clear the text of a `TextInput`-compatible component.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async clearText(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'clearText');
    this.callProp(props, 'onChangeText', identifier)('');
  }

  // Public: 'Press' a component (e.g. a `<Button />`).
  // Your component should respond to the property `onPress`.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async press(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'press');
    this.callProp(props, 'onPress', identifier)();
  }

  // Public: Alias of `press`.
  async tap(identifier: ComponentIdentifier): Promise<void> {
    return this.press(identifier);
  }

  // Public: 'Press' a component twice in quick succession.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async doublePress(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'doublePress');
    const onPress = this.callProp(props, 'onPress', identifier);
    onPress();
    onPress();
  }

  // Public: 'Long press' a component.
  // Your component should respond to the property `onLongPress`.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async longPress(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'longPress');
    this.callProp(props, 'onLongPress', identifier)();
  }

  // Public: 'Focus' a component (e.g. a `<TextInput />`).
  // Your component should respond to the property `onFocus`.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async focus(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'focus');
    this.callProp(props, 'onFocus', identifier)();
  }

  // Public: 'Blur' a component (e.g. a `<TextInput />`).
  // Your component should respond to the property `onBlur`.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async blur(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'blur');
    this.callProp(props, 'onBlur', identifier)();
  }

  // Public: Toggle a `<Switch />`-compatible component: calls `onValueChange`
  // with the opposite of its current `value` prop.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async toggleSwitch(identifier: ComponentIdentifier): Promise<void> {
    const props = await this.propsOf(identifier, 'toggleSwitch');
    this.callProp(props, 'onValueChange', identifier)(!props.value);
  }

  // Public: Set the value of a component that responds to `onValueChange`
  // (e.g. a `<Switch />` or a slider).
  //
  // identifier - Identifier or selector for the component.
  // value      - The value to set.
  //
  // Returns a promise; use `await` when calling this function.
  async setValue(identifier: ComponentIdentifier, value: unknown): Promise<void> {
    const props = await this.propsOf(identifier, 'setValue');
    this.callProp(props, 'onValueChange', identifier)(value);
  }

  // Public: Scroll a scrollable component to a given content offset.
  //
  // Prefers the imperative `scrollTo` method exposed by `ScrollView` and
  // `FlatList`; falls back to invoking `onScroll` with a synthetic native
  // event, which is what a plain hooked component will respond to.
  //
  // identifier - Identifier or selector for the component.
  // offset     - `{ x, y }` content offset to scroll to. Missing axes are 0.
  //
  // Returns a promise; use `await` when calling this function.
  async scrollTo(
    identifier: ComponentIdentifier,
    offset: { x?: number; y?: number },
  ): Promise<void> {
    const component = await this.findComponent(identifier);
    const contentOffset = { x: offset.x ?? 0, y: offset.y ?? 0 };

    if (typeof component.scrollTo === 'function') {
      component.scrollTo({ ...contentOffset, animated: false });
      return;
    }

    const props = this.assertProps(component, identifier, 'scrollTo');
    this.callProp(props, 'onScroll', identifier)({ nativeEvent: { contentOffset } });
  }

  // Public: Scroll a scrollable component to its end.
  //
  // Prefers the imperative `scrollToEnd` method exposed by `ScrollView` and
  // `FlatList`; falls back to `onScroll` with a very large offset.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise; use `await` when calling this function.
  async scrollToEnd(identifier: ComponentIdentifier): Promise<void> {
    const component = await this.findComponent(identifier);

    if (typeof component.scrollToEnd === 'function') {
      component.scrollToEnd({ animated: false });
      return;
    }

    const props = this.assertProps(component, identifier, 'scrollToEnd');
    this.callProp(
      props,
      'onScroll',
      identifier,
    )({
      nativeEvent: { contentOffset: { x: 0, y: Number.MAX_SAFE_INTEGER } },
    });
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
  // options   - (Optional) A timeout in ms, or `{ timeout, interval }`.
  //             Defaults to the Tester's `waitTime` and 100ms polling.
  //
  // Returns a promise; rejects with a TimeoutError if the predicate never
  // becomes truthy.
  async waitFor(
    predicate: () => boolean | Promise<boolean>,
    options?: number | WaitForOptions,
  ): Promise<void> {
    const { timeout, interval } = this.waitOptions(options);
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

      await this.pause(interval);
    }
  }

  // Public: Wait until a component is no longer present.
  //
  // identifier - Identifier or selector for the component.
  // options    - (Optional) A timeout in ms, or `{ timeout, interval }`.
  //
  // Returns a promise; rejects with a TimeoutError if the component is still
  // present when the timeout elapses.
  async waitForElementToBeRemoved(
    identifier: ComponentIdentifier,
    options?: number | WaitForOptions,
  ): Promise<void> {
    const { timeout, interval } = this.waitOptions(options);
    const startTime = Date.now();

    for (;;) {
      if (!this.lookup(identifier)) {
        return;
      }

      if (Date.now() - startTime >= timeout) {
        throw new TimeoutError(
          `Timed out after ${timeout}ms waiting for ${describeIdentifier(identifier)} to be removed`,
        );
      }

      await this.pause(interval);
    }
  }

  // Internal: Normalise `waitFor`-style options.
  private waitOptions(options?: number | WaitForOptions): { timeout: number; interval: number } {
    if (typeof options === 'number') {
      return { timeout: options, interval: DEFAULT_POLL_INTERVAL };
    }
    return {
      timeout: options?.timeout ?? this.waitTime,
      interval: options?.interval ?? DEFAULT_POLL_INTERVAL,
    };
  }

  // ASSERTIONS

  // Public: Component-specific matchers for the given component.
  //
  // identifier - Identifier or selector for the component.
  //
  // Example
  //
  //   await spec.expectComponent('Login.error').toBeVisible();
  //   await spec.expectComponent(by.text('Welcome')).toExist();
  //   await spec.expectComponent('Login.email').not.toBeDisabled();
  //
  // Returns a ComponentExpectation whose matchers return promises.
  expectComponent(identifier: ComponentIdentifier): ComponentExpectation {
    return new ComponentExpectation(this, identifier);
  }

  // Public: Check a component exists.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise resolving to `true`; rejects if the component is never
  // found.
  async exists(identifier: ComponentIdentifier): Promise<boolean> {
    const component = await this.findComponent(identifier);
    return !!component;
  }

  // Public: Check for the absence of a component. Will potentially halt your
  // test for the full wait time.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise resolving to `true` when the component is absent;
  // rejects if the component is present.
  async notExists(identifier: ComponentIdentifier): Promise<boolean> {
    try {
      await this.findComponent(identifier);
    } catch (e) {
      if (e instanceof Error && e.name === 'ComponentNotFoundError') {
        return true;
      }
      throw e;
    }
    throw new Error(`Component with identifier ${describeIdentifier(identifier)} was present`);
  }

  // Public: Check that a component is present *and* not hidden by its style.
  //
  // Catches the common case of a component that is mounted but invisible
  // (`display: 'none'`, zero opacity). Only style props are inspected; this is
  // not a real hit test.
  //
  // identifier - Identifier or selector for the component.
  //
  // Returns a promise resolving to `true`; rejects if missing or hidden.
  async expectVisible(identifier: ComponentIdentifier): Promise<boolean> {
    const props = await this.propsOf(identifier, 'expectVisible');
    const styles = flattenStyle(props.style);

    if (styles.display === 'none') {
      throw new Error(
        `Component with identifier ${describeIdentifier(identifier)} has display: 'none'`,
      );
    }
    if (styles.opacity === 0) {
      throw new Error(`Component with identifier ${describeIdentifier(identifier)} has opacity: 0`);
    }

    return true;
  }

  // Public: Check whether a component, e.g. `<Text>`, contains the given text
  // string as a child.
  //
  // identifier - Identifier or selector for the component.
  // text       - String the component's children should contain.
  //
  // Returns a promise; rejects if the component is not found, has not been
  // wrapped, or does not contain the text.
  async containsText(identifier: ComponentIdentifier, text: string): Promise<void> {
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
  private async propsOf(
    identifier: ComponentIdentifier,
    helper: string,
  ): Promise<Record<string, any>> {
    const component = await this.findComponent(identifier);
    return this.assertProps(component, identifier, helper);
  }

  // Internal: Assert that a hooked component exposes props.
  private assertProps(
    component: HookedComponent,
    identifier: ComponentIdentifier,
    helper: string,
  ): Record<string, any> {
    if (!component.props) {
      throw new UnwrappedComponentError(
        `Component with identifier ${describeIdentifier(identifier)} does not expose any props, so ` +
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
    identifier: ComponentIdentifier,
  ): (...args: any[]) => any {
    const fn = props[prop];
    if (typeof fn !== 'function') {
      throw new MissingPropError(
        `Component with identifier ${describeIdentifier(identifier)} does not respond to \`${prop}\``,
      );
    }
    return fn;
  }
}
