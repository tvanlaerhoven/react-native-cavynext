import TestHookStore from '../TestHookStore';

describe('TestHookStore', () => {
  it('stores and retrieves a component by identifier', () => {
    const store = new TestHookStore();
    const component = { props: { onPress: jest.fn() } };

    store.add('Scene.button', component);

    expect(store.get('Scene.button')).toBe(component);
  });

  it('replaces an existing component registered under the same identifier', () => {
    const store = new TestHookStore();
    const first = { props: {} };
    const second = { props: {} };

    store.add('Scene.button', first);
    store.add('Scene.button', second);

    expect(store.get('Scene.button')).toBe(second);
  });

  it('returns undefined for unknown identifiers', () => {
    const store = new TestHookStore();

    expect(store.get('nope')).toBeUndefined();
  });

  it('removes a component', () => {
    const store = new TestHookStore();
    store.add('Scene.button', { props: {} });

    store.remove('Scene.button');

    expect(store.get('Scene.button')).toBeUndefined();
  });

  it('lists the registered identifiers', () => {
    const store = new TestHookStore();
    store.add('a', { props: {} });
    store.add('b', { props: {} });

    expect(store.identifiers().sort()).toEqual(['a', 'b']);
  });
});
