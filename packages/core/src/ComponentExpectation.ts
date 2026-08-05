import { describeIdentifier, stringifyChildren, type ComponentIdentifier } from './by';
import { AssertionError, deepEqual } from './expect';
import type { HookedComponent } from './types';

// Internal: The subset of TestScope that ComponentExpectation needs, declared
// as an interface to avoid a circular import.
export interface ComponentFinder {
  findComponent(identifier: ComponentIdentifier): Promise<HookedComponent>;
}

// Public: Async, component-specific matchers, created via
// `spec.expectComponent(identifier)`.
//
// Every matcher waits for the component to appear (up to the Tester's
// `waitTime`) before asserting, and every matcher is available negated
// through `.not`.
//
// Example
//
//   await spec.expectComponent('LoginScreen.error').toBeVisible();
//   await spec.expectComponent('LoginScreen.email').toHaveValue('a@b.c');
//   await spec.expectComponent(by.text('Welcome')).toExist();
export default class ComponentExpectation {
  private readonly finder: ComponentFinder;
  private readonly identifier: ComponentIdentifier;
  private readonly negated: boolean;

  constructor(finder: ComponentFinder, identifier: ComponentIdentifier, negated = false) {
    this.finder = finder;
    this.identifier = identifier;
    this.negated = negated;
  }

  // Public: Negate the following matcher.
  get not(): ComponentExpectation {
    return new ComponentExpectation(this.finder, this.identifier, !this.negated);
  }

  // Public: The component exists (or, negated, does not exist within the wait
  // time).
  async toExist(): Promise<void> {
    let exists = true;
    try {
      await this.finder.findComponent(this.identifier);
    } catch (e) {
      if (e instanceof Error && e.name === 'ComponentNotFoundError') {
        exists = false;
      } else {
        throw e;
      }
    }
    this.assert(
      exists,
      `Expected component ${this.name()} to exist`,
      `Expected component ${this.name()} not to exist, but it was found`,
    );
  }

  // Public: The component exists and is not hidden by its style
  // (`display: 'none'` or zero opacity).
  async toBeVisible(): Promise<void> {
    const props = await this.props();
    const styles = flattenStyle(props.style);
    const visible = styles.display !== 'none' && styles.opacity !== 0;
    this.assert(
      visible,
      `Expected component ${this.name()} to be visible, but its style hides it`,
      `Expected component ${this.name()} not to be visible`,
    );
  }

  // Public: The component's rendered text equals the given string exactly.
  async toHaveText(text: string): Promise<void> {
    const actual = stringifyChildren((await this.props()).children);
    this.assert(
      actual === text,
      `Expected component ${this.name()} to have text ${JSON.stringify(text)}, but it has ${JSON.stringify(actual)}`,
      `Expected component ${this.name()} not to have text ${JSON.stringify(text)}`,
    );
  }

  // Public: The component's rendered text contains the given string or
  // matches the RegExp.
  async toContainText(text: string | RegExp): Promise<void> {
    const actual = stringifyChildren((await this.props()).children);
    const pass = typeof text === 'string' ? actual.includes(text) : text.test(actual);
    this.assert(
      pass,
      `Expected component ${this.name()} text ${JSON.stringify(actual)} to contain ${String(text)}`,
      `Expected component ${this.name()} text not to contain ${String(text)}`,
    );
  }

  // Public: The component has the given prop; when `value` is provided, the
  // prop must deep-equal it.
  async toHaveProp(name: string, value?: unknown): Promise<void> {
    const props = await this.props();
    const has = name in props;
    const pass = arguments.length < 2 ? has : has && deepEqual(props[name], value);
    this.assert(
      pass,
      arguments.length < 2
        ? `Expected component ${this.name()} to have prop ${JSON.stringify(name)}`
        : `Expected component ${this.name()} prop ${JSON.stringify(name)} to equal ${JSON.stringify(value)}, but it is ${JSON.stringify(props[name])}`,
      `Expected component ${this.name()} not to have prop ${JSON.stringify(name)}${arguments.length < 2 ? '' : ` equal to ${JSON.stringify(value)}`}`,
    );
  }

  // Public: The component's `value` prop equals the given value (e.g. a
  // `TextInput` or `Slider`).
  async toHaveValue(value: unknown): Promise<void> {
    const props = await this.props();
    this.assert(
      deepEqual(props.value, value),
      `Expected component ${this.name()} to have value ${JSON.stringify(value)}, but it has ${JSON.stringify(props.value)}`,
      `Expected component ${this.name()} not to have value ${JSON.stringify(value)}`,
    );
  }

  // Public: The component is not disabled (`disabled` prop falsy).
  async toBeEnabled(): Promise<void> {
    const props = await this.props();
    this.assert(
      !props.disabled,
      `Expected component ${this.name()} to be enabled, but it is disabled`,
      `Expected component ${this.name()} not to be enabled`,
    );
  }

  // Public: The component is disabled (`disabled` prop truthy).
  async toBeDisabled(): Promise<void> {
    const props = await this.props();
    this.assert(
      !!props.disabled,
      `Expected component ${this.name()} to be disabled, but it is enabled`,
      `Expected component ${this.name()} not to be disabled`,
    );
  }

  // Public: The component is checked/on: its `value` prop is `true` (Switch)
  // or its `checked`/`accessibilityState.checked` is `true`.
  async toBeChecked(): Promise<void> {
    const props = await this.props();
    const checked =
      props.value === true || props.checked === true || props.accessibilityState?.checked === true;
    this.assert(
      checked,
      `Expected component ${this.name()} to be checked`,
      `Expected component ${this.name()} not to be checked`,
    );
  }

  // Public: The component's flattened style includes the given subset.
  async toHaveStyle(style: Record<string, unknown>): Promise<void> {
    const styles = flattenStyle((await this.props()).style);
    const pass = Object.keys(style).every((key) => deepEqual(styles[key], style[key]));
    this.assert(
      pass,
      `Expected component ${this.name()} to have style ${JSON.stringify(style)}, but its style is ${JSON.stringify(styles)}`,
      `Expected component ${this.name()} not to have style ${JSON.stringify(style)}`,
    );
  }

  // Public: The component's accessibility label equals the given string.
  async toHaveAccessibilityLabel(label: string): Promise<void> {
    const props = await this.props();
    const actual = props.accessibilityLabel ?? props['aria-label'];
    this.assert(
      actual === label,
      `Expected component ${this.name()} to have accessibility label ${JSON.stringify(label)}, but it has ${JSON.stringify(actual)}`,
      `Expected component ${this.name()} not to have accessibility label ${JSON.stringify(label)}`,
    );
  }

  // Internal: Find the component and return its props (empty object when it
  // exposes none).
  private async props(): Promise<Record<string, any>> {
    const component = await this.finder.findComponent(this.identifier);
    return component.props ?? {};
  }

  // Internal: Throw when the outcome does not match the (possibly negated)
  // expectation.
  private assert(pass: boolean, message: string, negatedMessage: string): void {
    if (pass === this.negated) {
      throw new AssertionError(this.negated ? negatedMessage : message);
    }
  }

  // Internal: Human-readable identifier for error messages.
  private name(): string {
    return describeIdentifier(this.identifier);
  }
}

// Internal: Collapse a React Native style prop (object, array, or nested
// arrays) into a single plain object.
export function flattenStyle(style: any): Record<string, any> {
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
