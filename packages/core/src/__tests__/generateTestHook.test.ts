import generateTestHook from '../generateTestHook';
import TestHookStore from '../TestHookStore';

describe('generateTestHook', () => {
  it('adds the component to the store when the ref is set', () => {
    const store = new TestHookStore();
    const component = { props: {} };

    generateTestHook(store)('Scene.button')(component);

    expect(store.get('Scene.button')).toBe(component);
  });

  it('removes the component from the store when React unsets the ref', () => {
    const store = new TestHookStore();
    const ref = generateTestHook(store)('Scene.button');
    ref({ props: {} });

    ref(null);

    expect(store.get('Scene.button')).toBeUndefined();
  });

  it("preserves the caller's own callback ref", () => {
    const store = new TestHookStore();
    const own = jest.fn();
    const component = { props: {} };

    generateTestHook(store)('Scene.button', own)(component);

    expect(own).toHaveBeenCalledWith(component);
  });

  it("preserves the caller's own ref object", () => {
    const store = new TestHookStore();
    const own: { current: unknown } = { current: null };
    const component = { props: {} };

    generateTestHook(store)('Scene.button', own)(component);

    expect(own.current).toBe(component);
  });

  it('only honours the caller ref when there is no store, i.e. in production', () => {
    const own = jest.fn();
    const component = { props: {} };

    // Should not throw, even though there is nowhere to register the hook.
    generateTestHook(undefined)('Scene.button', own)(component);

    expect(own).toHaveBeenCalledWith(component);
  });
});
