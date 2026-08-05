import type { HookedComponent } from './types';

// Internal: Find components by React Native's `testID` prop, so that an app can
// be tested without adding cavynext refs to its components.
//
// The test hook store can only see components that opted in via
// `generateTestHook`. Many apps already set `testID` for other tooling
// (Appium, Detox, accessibility), so this walks React's fiber tree instead and
// matches on that prop.
//
// This reads React's internals, which are not a public API. Everything here is
// therefore defensive: if the shape ever changes, lookups degrade to "not
// found" and the test hook store keeps working as before.

// Internal: The small part of a fiber node we rely on.
interface FiberNode {
  memoizedProps?: Record<string, any> | null;
  stateNode?: any;
  child?: FiberNode | null;
  sibling?: FiberNode | null;
  return?: FiberNode | null;
}

// Internal: Resolve the fiber tree that is currently committed.
//
// React keeps two fiber trees and swaps between them on each render, so a fiber
// captured earlier can become the stale one - and a component mounted by the
// latest render would be missing from it. Climbing to the root and reading its
// `current` pointer always lands on the committed tree.
export function currentRootFiber(fiber: FiberNode | undefined): FiberNode | undefined {
  if (!fiber) {
    return undefined;
  }

  let node: FiberNode = fiber;
  while (node.return) {
    node = node.return;
  }

  // The root fiber's stateNode is the FiberRoot, whose `current` is the tree
  // that was last committed.
  const fiberRoot = node.stateNode;
  return fiberRoot?.current ?? node;
}

// Internal: Depth-first search for the first fiber carrying a matching testID.
//
// The outermost match wins. For `<Pressable testID="x" onPress={...} />` that is
// the Pressable itself, whose props include both `testID` and `onPress`, which
// is what the spec helpers need.
export function findFiberByTestID(root: FiberNode | undefined, testID: string): FiberNode | null {
  if (!root) {
    return null;
  }

  // Explicit stack rather than recursion: component trees can be deep, and a
  // blown call stack inside a test helper would be a confusing failure.
  const pending: FiberNode[] = [];
  let node: FiberNode | null | undefined = root.child;

  while (node) {
    if (node.memoizedProps && node.memoizedProps.testID === testID) {
      return node;
    }

    if (node.child) {
      if (node.sibling) {
        pending.push(node.sibling);
      }
      node = node.child;
      continue;
    }

    if (node.sibling) {
      node = node.sibling;
      continue;
    }

    node = pending.pop();
  }

  return null;
}

// Internal: Present a fiber to the spec helpers as if it were a hooked
// component.
//
// `props` is read straight off the fiber on every access, so it is never stale
// the way a captured ref can be. Anything else is delegated to the underlying
// instance, which is how imperative methods such as `ScrollView#scrollTo`
// remain reachable.
export function hookedComponentFromFiber(fiber: FiberNode): HookedComponent {
  const instance = fiber.stateNode;

  return new Proxy({} as HookedComponent, {
    get(_target, key) {
      if (key === 'props') {
        return fiber.memoizedProps ?? {};
      }
      const value = instance?.[key];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
    has(_target, key) {
      if (key === 'props') {
        return true;
      }
      return instance != null && key in instance;
    },
  });
}

// Internal: Build the resolver handed to a TestScope.
//
// getRootFiber is a callback rather than a value because the Tester's fiber is
// only available once it has mounted.
export function createTestIDResolver(
  getRootFiber: () => FiberNode | undefined,
): (testID: string) => HookedComponent | undefined {
  return (testID: string) => {
    let fiber: FiberNode | null = null;
    try {
      fiber = findFiberByTestID(currentRootFiber(getRootFiber()), testID);
    } catch {
      // Swallowed on purpose: this relies on React internals, and a lookup
      // failure must never be louder than the test failure it would cause.
      return undefined;
    }
    return fiber ? hookedComponentFromFiber(fiber) : undefined;
  };
}
