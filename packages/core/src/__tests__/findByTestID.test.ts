import {
  createTestIDResolver,
  currentRootFiber,
  findFiberByTestID,
  hookedComponentFromFiber,
} from '../findByTestID';

// Builds a fiber-shaped tree, so the traversal can be tested without React.
interface FakeFiber {
  memoizedProps?: Record<string, any> | null;
  stateNode?: any;
  child?: FakeFiber | null;
  sibling?: FakeFiber | null;
}

function fiber(props: Record<string, any> | null, children: FakeFiber[] = []): FakeFiber {
  const [first, ...rest] = children;

  // Link the children up as a sibling chain, the way React does.
  let previous: FakeFiber | undefined = first;
  for (const next of rest) {
    if (previous) {
      previous.sibling = next;
    }
    previous = next;
  }

  return { memoizedProps: props, child: first ?? null, sibling: null };
}

describe('findFiberByTestID', () => {
  it('finds a deeply nested component', () => {
    const target = fiber({ testID: 'Deep.Target', onPress: () => {} });
    const root = fiber(null, [fiber({ testID: 'Other' }), fiber(null, [fiber(null, [target])])]);

    expect(findFiberByTestID(root, 'Deep.Target')).toBe(target);
  });

  it('searches every branch, not just the first', () => {
    const target = fiber({ testID: 'Second.Branch' });
    const root = fiber(null, [
      // A branch with children of its own, so the traversal has to backtrack.
      fiber(null, [fiber({ testID: 'First.Leaf' })]),
      fiber(null, [target]),
    ]);

    expect(findFiberByTestID(root, 'Second.Branch')).toBe(target);
  });

  it('returns null when nothing matches', () => {
    const root = fiber(null, [fiber({ testID: 'Present' })]);

    expect(findFiberByTestID(root, 'Absent')).toBeNull();
  });

  it('returns null for a missing root, rather than throwing', () => {
    expect(findFiberByTestID(undefined, 'Anything')).toBeNull();
  });

  it('ignores fibers with no props', () => {
    const root = fiber(null, [{ memoizedProps: null, child: null, sibling: null }]);

    expect(findFiberByTestID(root, 'undefined')).toBeNull();
  });
});

describe('currentRootFiber', () => {
  it('returns the committed tree, not a stale one', () => {
    // React keeps two trees and swaps between them. A fiber captured before a
    // render can end up in the stale one, where components mounted by the
    // latest render are missing entirely.
    const stale = fiber(null, [fiber({ testID: 'Old' })]);
    const committed = fiber(null, [fiber({ testID: 'New' })]);

    const fiberRoot = { current: committed };
    const staleRoot: any = stale;
    staleRoot.stateNode = fiberRoot;

    expect(currentRootFiber(staleRoot)).toBe(committed);
    expect(findFiberByTestID(currentRootFiber(staleRoot), 'New')).not.toBeNull();
  });

  it('climbs to the root from a nested fiber', () => {
    const root: any = fiber(null, []);
    root.stateNode = { current: root };

    const child: any = fiber({ testID: 'Child' });
    child.return = root;

    expect(currentRootFiber(child)).toBe(root);
  });

  it('falls back to the fiber it was given when there is no FiberRoot', () => {
    const orphan = fiber(null, []);

    expect(currentRootFiber(orphan)).toBe(orphan);
    expect(currentRootFiber(undefined)).toBeUndefined();
  });
});

describe('hookedComponentFromFiber', () => {
  it('reads props live, so they are never stale', () => {
    const node = fiber({ testID: 'Counter', value: 1 });
    const component = hookedComponentFromFiber(node);

    expect(component.props?.value).toBe(1);

    // A re-render replaces memoizedProps; the same handle must see the update.
    node.memoizedProps = { testID: 'Counter', value: 2 };
    expect(component.props?.value).toBe(2);
  });

  it('exposes props as an empty object when the fiber has none', () => {
    expect(hookedComponentFromFiber({ memoizedProps: null }).props).toEqual({});
  });

  it('delegates imperative methods to the instance, bound to it', () => {
    const instance = {
      scrolledTo: null as unknown,
      scrollTo(offset: unknown) {
        // Fails if `this` is not the instance.
        this.scrolledTo = offset;
      },
    };
    const component = hookedComponentFromFiber({ memoizedProps: {}, stateNode: instance });

    expect(typeof component.scrollTo).toBe('function');
    component.scrollTo({ y: 40 });
    expect(instance.scrolledTo).toEqual({ y: 40 });
  });
});

describe('createTestIDResolver', () => {
  it('resolves a testID to a usable component', () => {
    const onPress = jest.fn();
    const root = fiber(null, [fiber({ testID: 'Screen.Button', onPress })]);
    const resolve = createTestIDResolver(() => root);

    resolve('Screen.Button')?.props?.onPress();

    expect(onPress).toHaveBeenCalled();
  });

  it('returns undefined when there is no match', () => {
    const resolve = createTestIDResolver(() => fiber(null, []));

    expect(resolve('Nope')).toBeUndefined();
  });

  it('survives React internals being absent or unexpected', () => {
    // Defensive: this reads private React fields, so a shape change must
    // degrade to "not found" rather than break every lookup.
    const resolve = createTestIDResolver(() => undefined);
    expect(resolve('Anything')).toBeUndefined();

    const throwing = createTestIDResolver(() => {
      throw new Error('internals moved');
    });
    expect(throwing('Anything')).toBeUndefined();
  });
});
