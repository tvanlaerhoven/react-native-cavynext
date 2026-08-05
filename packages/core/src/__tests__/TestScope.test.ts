import TestHookStore from '../TestHookStore';
import TestScope from '../TestScope';

// Short wait time keeps the "never found" paths fast.
const WAIT_TIME = 300;

function newScope(store = new TestHookStore()) {
  return { store, spec: new TestScope(store, WAIT_TIME) };
}

describe('TestScope structure', () => {
  it('collects test cases with their describe label', () => {
    const { spec } = newScope();
    const body = async () => {};

    spec.describe('My Scene', () => {
      spec.it('has a component', body);
    });

    expect(spec.testCases).toEqual([
      { describeLabel: 'My Scene', label: 'has a component', f: body, tag: null },
    ]);
  });

  it('inherits the tag from the describe block', () => {
    const { spec } = newScope();

    spec.describe(
      'Tagged scene',
      () => {
        spec.it('runs', async () => {});
      },
      'focus',
    );

    expect(spec.testCases[0].tag).toBe('focus');
  });

  it('falls back to the tag given to `it`', () => {
    const { spec } = newScope();

    spec.describe('Scene', () => {
      spec.it('runs', async () => {}, 'smoke');
    });

    expect(spec.testCases[0].tag).toBe('smoke');
  });

  it('keeps `beforeEach` callable after registering a hook', () => {
    // Cavy assigned the function onto `this.beforeEach`, which destroyed the
    // method itself; a second call then threw. This guards that regression.
    const { spec } = newScope();
    const first = async () => {};
    const second = async () => {};

    spec.beforeEach(first);
    spec.beforeEach(second);

    expect(spec.beforeEachHook).toBe(second);
  });
});

describe('TestScope lookup', () => {
  it('resolves with a component that is already hooked', async () => {
    const { store, spec } = newScope();
    const component = { props: {} };
    store.add('Scene.button', component);

    await expect(spec.findComponent('Scene.button')).resolves.toBe(component);
  });

  it('resolves with a component that appears later', async () => {
    const { store, spec } = newScope();
    const component = { props: {} };
    setTimeout(() => store.add('Scene.late', component), 150);

    await expect(spec.findComponent('Scene.late')).resolves.toBe(component);
  });

  it('rejects with a ComponentNotFoundError after the wait time', async () => {
    const { spec } = newScope();

    await expect(spec.findComponent('Scene.missing')).rejects.toMatchObject({
      name: 'ComponentNotFoundError',
    });
  });
});

describe('TestScope actions', () => {
  it('fillIn calls onChangeText', async () => {
    const { store, spec } = newScope();
    const onChangeText = jest.fn();
    store.add('Scene.input', { props: { onChangeText } });

    await spec.fillIn('Scene.input', 'Amy');

    expect(onChangeText).toHaveBeenCalledWith('Amy');
  });

  it('changeText is an alias of fillIn', async () => {
    const { store, spec } = newScope();
    const onChangeText = jest.fn();
    store.add('Scene.input', { props: { onChangeText } });

    await spec.changeText('Scene.input', 'Amy');

    expect(onChangeText).toHaveBeenCalledWith('Amy');
  });

  it('press calls onPress', async () => {
    const { store, spec } = newScope();
    const onPress = jest.fn();
    store.add('Scene.button', { props: { onPress } });

    await spec.press('Scene.button');

    expect(onPress).toHaveBeenCalled();
  });

  it('longPress calls onLongPress', async () => {
    const { store, spec } = newScope();
    const onLongPress = jest.fn();
    store.add('Scene.button', { props: { onLongPress } });

    await spec.longPress('Scene.button');

    expect(onLongPress).toHaveBeenCalled();
  });

  it('focus calls onFocus', async () => {
    const { store, spec } = newScope();
    const onFocus = jest.fn();
    store.add('Scene.input', { props: { onFocus } });

    await spec.focus('Scene.input');

    expect(onFocus).toHaveBeenCalled();
  });

  it('throws a MissingPropError when the component lacks the prop', async () => {
    const { store, spec } = newScope();
    store.add('Scene.button', { props: {} });

    await expect(spec.press('Scene.button')).rejects.toMatchObject({
      name: 'MissingPropError',
    });
  });

  it('scrollTo prefers the imperative scrollTo method', async () => {
    const { store, spec } = newScope();
    const scrollTo = jest.fn();
    store.add('Scene.list', { props: {}, scrollTo });

    await spec.scrollTo('Scene.list', { y: 120 });

    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 120, animated: false });
  });

  it('scrollTo falls back to a synthetic onScroll event', async () => {
    const { store, spec } = newScope();
    const onScroll = jest.fn();
    store.add('Scene.list', { props: { onScroll } });

    await spec.scrollTo('Scene.list', { y: 80 });

    expect(onScroll).toHaveBeenCalledWith({ nativeEvent: { contentOffset: { x: 0, y: 80 } } });
  });

  it('waitFor resolves once the predicate becomes true', async () => {
    const { spec } = newScope();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 120);

    await expect(spec.waitFor(() => ready)).resolves.toBeUndefined();
  });

  it('waitFor rejects with a TimeoutError', async () => {
    const { spec } = newScope();

    await expect(spec.waitFor(() => false, 200)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });
});

describe('TestScope assertions', () => {
  it('exists resolves true for a hooked component', async () => {
    const { store, spec } = newScope();
    store.add('Scene.button', { props: {} });

    await expect(spec.exists('Scene.button')).resolves.toBe(true);
  });

  it('notExists resolves true when the component is absent', async () => {
    const { spec } = newScope();

    await expect(spec.notExists('Scene.missing')).resolves.toBe(true);
  });

  it('notExists rejects when the component is present', async () => {
    const { store, spec } = newScope();
    store.add('Scene.button', { props: {} });

    await expect(spec.notExists('Scene.button')).rejects.toThrow(/was present/);
  });

  it('containsText passes for a string child', async () => {
    const { store, spec } = newScope();
    store.add('Scene.title', { props: { children: 'Hello Amy' } });

    await expect(spec.containsText('Scene.title', 'Amy')).resolves.toBeUndefined();
  });

  it('containsText passes for array children', async () => {
    const { store, spec } = newScope();
    store.add('Scene.title', { props: { children: ['Hello ', 'Amy'] } });

    await expect(spec.containsText('Scene.title', 'Amy')).resolves.toBeUndefined();
  });

  it('containsText passes for numeric children', async () => {
    const { store, spec } = newScope();
    store.add('Scene.count', { props: { children: 42 } });

    await expect(spec.containsText('Scene.count', '42')).resolves.toBeUndefined();
  });

  it('containsText rejects when the text is missing', async () => {
    const { store, spec } = newScope();
    store.add('Scene.title', { props: { children: 'Hello Jim' } });

    await expect(spec.containsText('Scene.title', 'Amy')).rejects.toThrow(/Could not find text/);
  });

  it('containsText rejects with UnwrappedComponentError when props are absent', async () => {
    const { store, spec } = newScope();
    store.add('Scene.title', {});

    await expect(spec.containsText('Scene.title', 'Amy')).rejects.toMatchObject({
      name: 'UnwrappedComponentError',
    });
  });

  it('expectVisible passes for a styled but visible component', async () => {
    const { store, spec } = newScope();
    store.add('Scene.box', { props: { style: [{ flex: 1 }, { opacity: 1 }] } });

    await expect(spec.expectVisible('Scene.box')).resolves.toBe(true);
  });

  it('expectVisible rejects for display none', async () => {
    const { store, spec } = newScope();
    store.add('Scene.box', { props: { style: { display: 'none' } } });

    await expect(spec.expectVisible('Scene.box')).rejects.toThrow(/display/);
  });

  it('expectVisible rejects for zero opacity in a style array', async () => {
    const { store, spec } = newScope();
    store.add('Scene.box', { props: { style: [{ opacity: 1 }, { opacity: 0 }] } });

    await expect(spec.expectVisible('Scene.box')).rejects.toThrow(/opacity/);
  });
});
