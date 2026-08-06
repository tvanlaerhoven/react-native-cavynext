import { by } from '../by';
import { AssertionError } from '../expect';
import TestHookStore from '../TestHookStore';
import TestScope from '../TestScope';
import type { HookedComponent } from '../types';
import type { Selector } from '../by';

// A short wait time keeps the "never found" paths fast.
const WAIT_TIME = 250;

function scopeWith(
  components: Record<string, HookedComponent>,
  selectorResolver?: (selector: Selector) => HookedComponent | undefined,
): { scope: TestScope; store: TestHookStore } {
  const store = new TestHookStore();
  for (const [identifier, component] of Object.entries(components)) {
    store.add(identifier, component);
  }
  const scope = new TestScope(store, WAIT_TIME, undefined, selectorResolver);
  return { scope, store };
}

describe('TestScope structure', () => {
  it('collects test cases with their describe label', () => {
    const { scope } = scopeWith({});
    const body = async () => {};

    scope.describe('My Scene', () => {
      scope.it('has a component', body);
    });

    expect(scope.testCases).toHaveLength(1);
    expect(scope.testCases[0]).toMatchObject({
      describeLabel: 'My Scene',
      label: 'has a component',
      f: body,
      tag: null,
    });
  });

  it('inherits the tag from the describe block', () => {
    const { scope } = scopeWith({});

    scope.describe(
      'Tagged scene',
      () => {
        scope.it('runs', async () => {});
      },
      'focus',
    );

    expect(scope.testCases[0].tag).toBe('focus');
  });

  it('falls back to the tag given to `it`', () => {
    const { scope } = scopeWith({});

    scope.describe('Scene', () => {
      scope.it('runs', async () => {}, 'smoke');
    });

    expect(scope.testCases[0].tag).toBe('smoke');
  });

  it('supports nested describe blocks', () => {
    const { scope } = scopeWith({});
    scope.describe('Outer', () => {
      scope.describe('Inner', () => {
        scope.it('does something', async () => {});
      });
      scope.it('at outer level', async () => {});
    });

    expect(scope.testCases.map((t) => t.describeLabel)).toEqual(['Outer > Inner', 'Outer']);
  });

  it('marks tests from xit and xdescribe as skipped', () => {
    const { scope } = scopeWith({});
    scope.describe('Group', () => {
      scope.xit('skipped test', async () => {});
      scope.it('normal test', async () => {});
    });
    scope.xdescribe('Skipped group', () => {
      scope.it('inherits skip', async () => {});
    });

    expect(scope.testCases.map((t) => !!t.skipped)).toEqual([true, false, true]);
  });

  it('describeIf and itIf skip when the condition is false', () => {
    const { scope } = scopeWith({});
    scope.describeIf(false, 'Skipped group', () => {
      scope.it('inherits skip', async () => {});
    });
    scope.describeIf(true, 'Running group', () => {
      scope.itIf(false, 'skipped test', async () => {});
      scope.itIf(true, 'running test', async () => {});
    });

    expect(scope.testCases.map((t) => !!t.skipped)).toEqual([true, true, false]);
  });

  it('marks tests from fit and fdescribe as focused', () => {
    const { scope } = scopeWith({});
    scope.describe('Group', () => {
      scope.fit('focused test', async () => {});
      scope.it('normal test', async () => {});
    });
    scope.fdescribe('Focused group', () => {
      scope.it('inherits focus', async () => {});
    });

    expect(scope.testCases.map((t) => !!t.focused)).toEqual([true, false, true]);
  });

  it('composes multiple beforeEach and afterEach hooks in order', async () => {
    const { scope } = scopeWith({});
    const calls: string[] = [];
    scope.beforeEach(async () => {
      calls.push('before1');
    });
    scope.beforeEach(async () => {
      calls.push('before2');
    });
    scope.afterEach(async () => {
      calls.push('after1');
    });
    scope.beforeAll(async () => {
      calls.push('beforeAll');
    });
    scope.afterAll(async () => {
      calls.push('afterAll');
    });

    await scope.beforeAllHook?.call(scope);
    await scope.beforeEachHook?.call(scope);
    await scope.afterEachHook?.call(scope);
    await scope.afterAllHook?.call(scope);

    expect(calls).toEqual(['beforeAll', 'before1', 'before2', 'after1', 'afterAll']);
  });
});

describe('TestScope lookup', () => {
  it('resolves with a component that is already hooked', async () => {
    const component = { props: {} };
    const { scope } = scopeWith({ 'Scene.button': component });

    await expect(scope.findComponent('Scene.button')).resolves.toBe(component);
  });

  it('resolves with a component that appears later', async () => {
    const { scope, store } = scopeWith({});
    const component = { props: {} };
    setTimeout(() => store.add('Scene.late', component), 150);

    await expect(scope.findComponent('Scene.late')).resolves.toBe(component);
  });

  it('rejects with a ComponentNotFoundError after the wait time', async () => {
    const { scope } = scopeWith({});

    await expect(scope.findComponent('Scene.missing')).rejects.toMatchObject({
      name: 'ComponentNotFoundError',
    });
  });
});

describe('TestScope selectors', () => {
  it('resolves by.id through the hook store first', async () => {
    const component = { props: { onPress: jest.fn() } };
    const { scope } = scopeWith({ 'Scene.button': component });

    await expect(scope.findComponent(by.id('Scene.button'))).resolves.toBe(component);
  });

  it('resolves selectors through the selector resolver', async () => {
    const component = { props: { children: 'Hello' } };
    const { scope } = scopeWith({}, (selector) =>
      selector.kind === 'text' && selector.value === 'Hello' ? component : undefined,
    );

    await expect(scope.findComponent(by.text('Hello'))).resolves.toBe(component);
  });

  it('rejects with a helpful message for unknown selectors', async () => {
    const { scope } = scopeWith({});
    await expect(scope.findComponent(by.label('Nope'))).rejects.toThrow('by.label(Nope)');
  });
});

describe('TestScope interactions', () => {
  it('fillIn calls onChangeText', async () => {
    const onChangeText = jest.fn();
    const { scope } = scopeWith({ 'Scene.input': { props: { onChangeText } } });

    await scope.fillIn('Scene.input', 'Amy');

    expect(onChangeText).toHaveBeenCalledWith('Amy');
  });

  it('changeText is an alias of fillIn', async () => {
    const onChangeText = jest.fn();
    const { scope } = scopeWith({ 'Scene.input': { props: { onChangeText } } });

    await scope.changeText('Scene.input', 'Amy');

    expect(onChangeText).toHaveBeenCalledWith('Amy');
  });

  it('press calls onPress', async () => {
    const onPress = jest.fn();
    const { scope } = scopeWith({ 'Scene.button': { props: { onPress } } });

    await scope.press('Scene.button');

    expect(onPress).toHaveBeenCalled();
  });

  it('longPress calls onLongPress', async () => {
    const onLongPress = jest.fn();
    const { scope } = scopeWith({ 'Scene.button': { props: { onLongPress } } });

    await scope.longPress('Scene.button');

    expect(onLongPress).toHaveBeenCalled();
  });

  it('focus calls onFocus', async () => {
    const onFocus = jest.fn();
    const { scope } = scopeWith({ 'Scene.input': { props: { onFocus } } });

    await scope.focus('Scene.input');

    expect(onFocus).toHaveBeenCalled();
  });

  it('throws a MissingPropError when the component lacks the prop', async () => {
    const { scope } = scopeWith({ 'Scene.button': { props: {} } });

    await expect(scope.press('Scene.button')).rejects.toMatchObject({
      name: 'MissingPropError',
    });
  });

  it('scrollTo prefers the imperative scrollTo method', async () => {
    const scrollTo = jest.fn();
    const { scope } = scopeWith({ 'Scene.list': { props: {}, scrollTo } });

    await scope.scrollTo('Scene.list', { y: 120 });

    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 120, animated: false });
  });

  it('scrollTo falls back to a synthetic onScroll event', async () => {
    const onScroll = jest.fn();
    const { scope } = scopeWith({ 'Scene.list': { props: { onScroll } } });

    await scope.scrollTo('Scene.list', { y: 80 });

    expect(onScroll).toHaveBeenCalledWith({ nativeEvent: { contentOffset: { x: 0, y: 80 } } });
  });

  it('tap is an alias of press', async () => {
    const onPress = jest.fn();
    const { scope } = scopeWith({ btn: { props: { onPress } } });
    await scope.tap('btn');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('doublePress presses twice', async () => {
    const onPress = jest.fn();
    const { scope } = scopeWith({ btn: { props: { onPress } } });
    await scope.doublePress('btn');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('typeText appends to the current value', async () => {
    const onChangeText = jest.fn();
    const { scope } = scopeWith({ input: { props: { value: 'foo', onChangeText } } });
    await scope.typeText('input', 'bar');
    expect(onChangeText).toHaveBeenCalledWith('foobar');
  });

  it('clearText empties the input', async () => {
    const onChangeText = jest.fn();
    const { scope } = scopeWith({ input: { props: { value: 'foo', onChangeText } } });
    await scope.clearText('input');
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('blur calls onBlur', async () => {
    const onBlur = jest.fn();
    const { scope } = scopeWith({ input: { props: { onBlur } } });
    await scope.blur('input');
    expect(onBlur).toHaveBeenCalled();
  });

  it('toggleSwitch flips the value prop', async () => {
    const onValueChange = jest.fn();
    const { scope } = scopeWith({ sw: { props: { value: true, onValueChange } } });
    await scope.toggleSwitch('sw');
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('setValue passes the value through', async () => {
    const onValueChange = jest.fn();
    const { scope } = scopeWith({ slider: { props: { onValueChange } } });
    await scope.setValue('slider', 0.5);
    expect(onValueChange).toHaveBeenCalledWith(0.5);
  });

  it('scrollToEnd prefers the imperative method', async () => {
    const scrollToEnd = jest.fn();
    const { scope } = scopeWith({ list: { props: {}, scrollToEnd } });
    await scope.scrollToEnd('list');
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });
});

describe('TestScope wait helpers', () => {
  it('waitFor resolves once the predicate becomes true', async () => {
    const { scope } = scopeWith({});
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 120);

    await expect(scope.waitFor(() => ready)).resolves.toBeUndefined();
  });

  it('waitFor rejects with a TimeoutError', async () => {
    const { scope } = scopeWith({});

    await expect(scope.waitFor(() => false, 200)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('waitFor accepts an options object', async () => {
    const { scope } = scopeWith({});
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 50);
    await scope.waitFor(() => ready, { timeout: 1000, interval: 10 });
  });

  it('waitForElementToBeRemoved resolves once the component disappears', async () => {
    const { scope, store } = scopeWith({ gone: { props: {} } });
    setTimeout(() => store.remove('gone'), 50);
    await scope.waitForElementToBeRemoved('gone', { timeout: 1000, interval: 10 });
  });

  it('waitForElementToBeRemoved times out when the component stays', async () => {
    const { scope } = scopeWith({ stays: { props: {} } });
    await expect(
      scope.waitForElementToBeRemoved('stays', { timeout: 100, interval: 10 }),
    ).rejects.toThrow('to be removed');
  });
});

describe('TestScope assertions', () => {
  it('exists resolves true for a hooked component', async () => {
    const { scope } = scopeWith({ 'Scene.button': { props: {} } });

    await expect(scope.exists('Scene.button')).resolves.toBe(true);
  });

  it('notExists resolves true when the component is absent', async () => {
    const { scope } = scopeWith({});

    await expect(scope.notExists('Scene.missing')).resolves.toBe(true);
  });

  it('notExists rejects when the component is present', async () => {
    const { scope } = scopeWith({ 'Scene.button': { props: {} } });

    await expect(scope.notExists('Scene.button')).rejects.toThrow(/was present/);
  });

  it('containsText passes for a string child', async () => {
    const { scope } = scopeWith({ 'Scene.title': { props: { children: 'Hello Amy' } } });

    await expect(scope.containsText('Scene.title', 'Amy')).resolves.toBeUndefined();
  });

  it('containsText passes for array children', async () => {
    const { scope } = scopeWith({ 'Scene.title': { props: { children: ['Hello ', 'Amy'] } } });

    await expect(scope.containsText('Scene.title', 'Amy')).resolves.toBeUndefined();
  });

  it('containsText passes for numeric children', async () => {
    const { scope } = scopeWith({ 'Scene.count': { props: { children: 42 } } });

    await expect(scope.containsText('Scene.count', '42')).resolves.toBeUndefined();
  });

  it('containsText rejects when the text is missing', async () => {
    const { scope } = scopeWith({ 'Scene.title': { props: { children: 'Hello Jim' } } });

    await expect(scope.containsText('Scene.title', 'Amy')).rejects.toThrow(/Could not find text/);
  });

  it('containsText rejects with UnwrappedComponentError when props are absent', async () => {
    const { scope } = scopeWith({ 'Scene.title': {} });

    await expect(scope.containsText('Scene.title', 'Amy')).rejects.toMatchObject({
      name: 'UnwrappedComponentError',
    });
  });

  it('expectVisible passes for a styled but visible component', async () => {
    const { scope } = scopeWith({
      'Scene.box': { props: { style: [{ flex: 1 }, { opacity: 1 }] } },
    });

    await expect(scope.expectVisible('Scene.box')).resolves.toBe(true);
  });

  it('expectVisible rejects for display none', async () => {
    const { scope } = scopeWith({ 'Scene.box': { props: { style: { display: 'none' } } } });

    await expect(scope.expectVisible('Scene.box')).rejects.toThrow(/display/);
  });

  it('expectVisible rejects for zero opacity in a style array', async () => {
    const { scope } = scopeWith({
      'Scene.box': { props: { style: [{ opacity: 1 }, { opacity: 0 }] } },
    });

    await expect(scope.expectVisible('Scene.box')).rejects.toThrow(/opacity/);
  });
});

describe('TestScope component expectations', () => {
  it('toExist and not.toExist', async () => {
    const { scope } = scopeWith({ present: { props: {} } });
    await scope.expectComponent('present').toExist();
    await scope.expectComponent('absent').not.toExist();
    await expect(scope.expectComponent('absent').toExist()).rejects.toThrow(AssertionError);
  });

  it('toBeVisible inspects style', async () => {
    const { scope } = scopeWith({
      shown: { props: { style: { opacity: 1 } } },
      hidden: { props: { style: [{ opacity: 1 }, { display: 'none' }] } },
    });
    await scope.expectComponent('shown').toBeVisible();
    await expect(scope.expectComponent('hidden').toBeVisible()).rejects.toThrow(AssertionError);
  });

  it('toHaveText and toContainText read children', async () => {
    const { scope } = scopeWith({ text: { props: { children: ['Hello', ' ', 'world'] } } });
    await scope.expectComponent('text').toHaveText('Hello world');
    await scope.expectComponent('text').toContainText('world');
    await scope.expectComponent('text').toContainText(/^Hello/);
    await expect(scope.expectComponent('text').toHaveText('nope')).rejects.toThrow(AssertionError);
  });

  it('toHaveProp and toHaveValue', async () => {
    const { scope } = scopeWith({ input: { props: { value: 'abc', placeholder: 'Type' } } });
    await scope.expectComponent('input').toHaveProp('placeholder');
    await scope.expectComponent('input').toHaveProp('placeholder', 'Type');
    await scope.expectComponent('input').toHaveValue('abc');
    await expect(scope.expectComponent('input').toHaveValue('x')).rejects.toThrow(AssertionError);
  });

  it('toBeEnabled, toBeDisabled and toBeChecked', async () => {
    const { scope } = scopeWith({
      on: { props: { value: true } },
      disabled: { props: { disabled: true } },
    });
    await scope.expectComponent('on').toBeEnabled();
    await scope.expectComponent('on').toBeChecked();
    await scope.expectComponent('disabled').toBeDisabled();
    await expect(scope.expectComponent('disabled').toBeEnabled()).rejects.toThrow(AssertionError);
  });

  it('toHaveStyle and toHaveAccessibilityLabel', async () => {
    const { scope } = scopeWith({
      styled: {
        props: { style: [{ opacity: 0.5 }, { margin: 4 }], accessibilityLabel: 'Close' },
      },
    });
    await scope.expectComponent('styled').toHaveStyle({ opacity: 0.5, margin: 4 });
    await scope.expectComponent('styled').toHaveAccessibilityLabel('Close');
    await expect(scope.expectComponent('styled').toHaveStyle({ margin: 8 })).rejects.toThrow(
      AssertionError,
    );
  });
});
