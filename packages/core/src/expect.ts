// Public: A Jest-style `expect` API for use inside specs.
//
// Example
//
//   import { expect } from 'react-native-cavynext';
//
//   spec.it('adds numbers', async () => {
//     expect(1 + 1).toBe(2);
//     expect([1, 2, 3]).toContain(2);
//     expect(() => JSON.parse('nope')).toThrow();
//     await expect(fetchName()).resolves.toBe('cavy');
//   });

// Public: Thrown when an `expect` matcher fails. Distinguished by `name`
// because errors crossing the React Native bridge lose their prototype chain.
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

// Public: The matchers available on `expect(value)`. Every matcher is also
// available negated through `.not`.
export interface Matchers<T> {
  // Strict equality (`Object.is`).
  toBe(expected: T): void;
  // Deep structural equality.
  toEqual(expected: unknown): void;
  // Deep structural equality, ignoring `undefined` properties.
  toStrictEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  // Substring for strings, deep-equal item for arrays/iterables.
  toContain(item: unknown): void;
  // Deep-equal item for arrays of objects.
  toContainEqual(item: unknown): void;
  toHaveLength(length: number): void;
  // Object has a (possibly nested, dot-separated) property, optionally equal
  // to a value.
  toHaveProperty(path: string, value?: unknown): void;
  // Substring or regular expression match on a string.
  toMatch(expected: string | RegExp): void;
  // The received object matches a subset of properties.
  toMatchObject(expected: Record<string, unknown>): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toBeInstanceOf(expected: new (...args: any[]) => unknown): void;
  // The received function throws, optionally with a message matching the
  // given string or RegExp.
  toThrow(expected?: string | RegExp): void;
  // Negated versions of every matcher.
  not: Matchers<T>;
}

// Public: The async matchers available on `expect(promise).resolves` and
// `.rejects`. Each returns a promise; `await` it.
export type AsyncMatchers<T> = {
  [K in Exclude<keyof Matchers<T>, 'not'>]: (...args: Parameters<Matchers<T>[K]>) => Promise<void>;
} & { not: AsyncMatchers<T> };

// Public: The value returned by `expect(...)`.
export interface Expectation<T> extends Matchers<T> {
  // Await the promise and run the matcher against the resolved value.
  resolves: AsyncMatchers<T extends PromiseLike<infer U> ? U : T>;
  // Await the promise, expect it to reject, and run the matcher against the
  // rejection reason.
  rejects: AsyncMatchers<unknown>;
}

// Public: Create an expectation for a value.
export function expect<T>(actual: T): Expectation<T> {
  const matchers = createMatchers(actual, false) as Expectation<T>;

  Object.defineProperty(matchers, 'resolves', {
    get: () => createAsyncMatchers(Promise.resolve(actual as any), 'resolves', false),
  });
  Object.defineProperty(matchers, 'rejects', {
    get: () => createAsyncMatchers(Promise.resolve(actual as any), 'rejects', false),
  });

  return matchers;
}

export default expect;

// Internal: Pretty-print a value for failure messages.
function stringify(value: unknown): string {
  if (typeof value === 'function') {
    return `[Function ${(value as { name?: string }).name || 'anonymous'}]`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

// Internal: Deep structural equality.
//
// strict - when true, `undefined` properties must match on both sides.
export function deepEqual(a: unknown, b: unknown, strict = false): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return String(a) === String(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i], strict));
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key), strict)) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const item of a) {
      let found = false;
      for (const other of b) {
        if (deepEqual(item, other, strict)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const keysOf = (o: object) =>
      Object.keys(o).filter((key) => strict || (o as Record<string, unknown>)[key] !== undefined);
    const aKeys = keysOf(a);
    const bKeys = keysOf(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], strict),
    );
  }
  return false;
}

// Internal: Does `received` contain a subset matching `expected`?
function matchesObject(received: unknown, expected: unknown): boolean {
  if (typeof expected !== 'object' || expected === null) {
    return deepEqual(received, expected);
  }
  if (typeof received !== 'object' || received === null) {
    return false;
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(received) &&
      expected.length === received.length &&
      expected.every((item, i) => matchesObject(received[i], item))
    );
  }
  return Object.keys(expected).every((key) =>
    matchesObject(
      (received as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
    ),
  );
}

// Internal: Resolve a dot-separated path against an object.
function getPath(value: unknown, path: string): { found: boolean; value: unknown } {
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || !(segment in Object(current))) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

// Internal: Build the synchronous matcher object for a value.
function createMatchers<T>(actual: T, negated: boolean): Matchers<T> {
  // Throw an AssertionError when the outcome does not match the expectation,
  // taking negation into account.
  const assert = (pass: boolean, message: string, negatedMessage: string): void => {
    if (pass === negated) {
      throw new AssertionError(negated ? negatedMessage : message);
    }
  };

  const matchers: Matchers<T> = {
    toBe(expected) {
      assert(
        Object.is(actual, expected),
        `Expected ${stringify(actual)} to be ${stringify(expected)}`,
        `Expected ${stringify(actual)} not to be ${stringify(expected)}`,
      );
    },
    toEqual(expected) {
      assert(
        deepEqual(actual, expected),
        `Expected ${stringify(actual)} to equal ${stringify(expected)}`,
        `Expected ${stringify(actual)} not to equal ${stringify(expected)}`,
      );
    },
    toStrictEqual(expected) {
      assert(
        deepEqual(actual, expected, true),
        `Expected ${stringify(actual)} to strictly equal ${stringify(expected)}`,
        `Expected ${stringify(actual)} not to strictly equal ${stringify(expected)}`,
      );
    },
    toBeTruthy() {
      assert(
        !!actual,
        `Expected ${stringify(actual)} to be truthy`,
        `Expected ${stringify(actual)} not to be truthy`,
      );
    },
    toBeFalsy() {
      assert(
        !actual,
        `Expected ${stringify(actual)} to be falsy`,
        `Expected ${stringify(actual)} not to be falsy`,
      );
    },
    toBeNull() {
      assert(
        actual === null,
        `Expected ${stringify(actual)} to be null`,
        `Expected value not to be null`,
      );
    },
    toBeUndefined() {
      assert(
        actual === undefined,
        `Expected ${stringify(actual)} to be undefined`,
        `Expected value not to be undefined`,
      );
    },
    toBeDefined() {
      assert(
        actual !== undefined,
        `Expected value to be defined`,
        `Expected ${stringify(actual)} not to be defined`,
      );
    },
    toBeNaN() {
      assert(
        typeof actual === 'number' && Number.isNaN(actual),
        `Expected ${stringify(actual)} to be NaN`,
        `Expected ${stringify(actual)} not to be NaN`,
      );
    },
    toContain(item) {
      let pass = false;
      if (typeof actual === 'string') {
        pass = typeof item === 'string' && actual.includes(item);
      } else if (actual != null && typeof (actual as any)[Symbol.iterator] === 'function') {
        for (const entry of actual as unknown as Iterable<unknown>) {
          if (Object.is(entry, item)) {
            pass = true;
            break;
          }
        }
      }
      assert(
        pass,
        `Expected ${stringify(actual)} to contain ${stringify(item)}`,
        `Expected ${stringify(actual)} not to contain ${stringify(item)}`,
      );
    },
    toContainEqual(item) {
      let pass = false;
      if (actual != null && typeof (actual as any)[Symbol.iterator] === 'function') {
        for (const entry of actual as unknown as Iterable<unknown>) {
          if (deepEqual(entry, item)) {
            pass = true;
            break;
          }
        }
      }
      assert(
        pass,
        `Expected ${stringify(actual)} to contain an item equal to ${stringify(item)}`,
        `Expected ${stringify(actual)} not to contain an item equal to ${stringify(item)}`,
      );
    },
    toHaveLength(length) {
      const actualLength = (actual as { length?: number } | null | undefined)?.length;
      assert(
        actualLength === length,
        `Expected ${stringify(actual)} to have length ${length}, but it has length ${actualLength}`,
        `Expected ${stringify(actual)} not to have length ${length}`,
      );
    },
    toHaveProperty(path, value) {
      const result = getPath(actual, path);
      const pass = result.found && (arguments.length < 2 || deepEqual(result.value, value));
      assert(
        pass,
        arguments.length < 2
          ? `Expected ${stringify(actual)} to have property ${stringify(path)}`
          : `Expected property ${stringify(path)} to equal ${stringify(value)}, but it is ${stringify(result.value)}`,
        `Expected ${stringify(actual)} not to have property ${stringify(path)}`,
      );
    },
    toMatch(expected) {
      const pass =
        typeof actual === 'string' &&
        (typeof expected === 'string' ? actual.includes(expected) : expected.test(actual));
      assert(
        pass,
        `Expected ${stringify(actual)} to match ${stringify(expected)}`,
        `Expected ${stringify(actual)} not to match ${stringify(expected)}`,
      );
    },
    toMatchObject(expected) {
      assert(
        matchesObject(actual, expected),
        `Expected ${stringify(actual)} to match object ${stringify(expected)}`,
        `Expected ${stringify(actual)} not to match object ${stringify(expected)}`,
      );
    },
    toBeGreaterThan(expected) {
      assert(
        typeof actual === 'number' && actual > expected,
        `Expected ${stringify(actual)} to be greater than ${expected}`,
        `Expected ${stringify(actual)} not to be greater than ${expected}`,
      );
    },
    toBeGreaterThanOrEqual(expected) {
      assert(
        typeof actual === 'number' && actual >= expected,
        `Expected ${stringify(actual)} to be greater than or equal to ${expected}`,
        `Expected ${stringify(actual)} not to be greater than or equal to ${expected}`,
      );
    },
    toBeLessThan(expected) {
      assert(
        typeof actual === 'number' && actual < expected,
        `Expected ${stringify(actual)} to be less than ${expected}`,
        `Expected ${stringify(actual)} not to be less than ${expected}`,
      );
    },
    toBeLessThanOrEqual(expected) {
      assert(
        typeof actual === 'number' && actual <= expected,
        `Expected ${stringify(actual)} to be less than or equal to ${expected}`,
        `Expected ${stringify(actual)} not to be less than or equal to ${expected}`,
      );
    },
    toBeCloseTo(expected, precision = 2) {
      const pass = typeof actual === 'number' && Math.abs(actual - expected) < 10 ** -precision / 2;
      assert(
        pass,
        `Expected ${stringify(actual)} to be close to ${expected} (precision ${precision})`,
        `Expected ${stringify(actual)} not to be close to ${expected} (precision ${precision})`,
      );
    },
    toBeInstanceOf(expected) {
      assert(
        actual instanceof expected,
        `Expected ${stringify(actual)} to be an instance of ${expected.name}`,
        `Expected ${stringify(actual)} not to be an instance of ${expected.name}`,
      );
    },
    toThrow(expected) {
      if (typeof actual !== 'function') {
        throw new AssertionError(
          `toThrow expects a function, received ${stringify(actual)}. ` +
            'Wrap the call: expect(() => doThing()).toThrow()',
        );
      }
      let thrown: unknown;
      let didThrow = false;
      try {
        (actual as unknown as () => unknown)();
      } catch (e) {
        didThrow = true;
        thrown = e;
      }
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      const pass =
        didThrow &&
        (expected === undefined ||
          (typeof expected === 'string' ? message.includes(expected) : expected.test(message)));
      assert(
        pass,
        expected === undefined
          ? 'Expected function to throw'
          : didThrow
            ? `Expected thrown error ${stringify(message)} to match ${stringify(expected)}`
            : `Expected function to throw an error matching ${stringify(expected)}`,
        expected === undefined
          ? `Expected function not to throw, but it threw ${stringify(thrown)}`
          : `Expected function not to throw an error matching ${stringify(expected)}`,
      );
    },
    get not() {
      return createMatchers(actual, !negated);
    },
  };

  return matchers;
}

// Internal: Build the async matcher object for `.resolves` / `.rejects`.
function createAsyncMatchers<T>(
  promise: Promise<T>,
  kind: 'resolves' | 'rejects',
  negated: boolean,
): AsyncMatchers<T> {
  // Resolve the value the matcher should run against.
  const settle = async (): Promise<unknown> => {
    if (kind === 'resolves') {
      try {
        return await promise;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new AssertionError(`Expected promise to resolve, but it rejected with: ${message}`);
      }
    }
    try {
      const value = await promise;
      throw new AssertionError(
        `Expected promise to reject, but it resolved with ${stringify(value)}`,
      );
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      return e;
    }
  };

  const wrap =
    (name: keyof Matchers<unknown>) =>
    async (...args: unknown[]): Promise<void> => {
      const value = await settle();
      (createMatchers(value, negated)[name] as (...a: unknown[]) => void)(...args);
    };

  const names: Exclude<keyof Matchers<unknown>, 'not'>[] = [
    'toBe',
    'toEqual',
    'toStrictEqual',
    'toBeTruthy',
    'toBeFalsy',
    'toBeNull',
    'toBeUndefined',
    'toBeDefined',
    'toBeNaN',
    'toContain',
    'toContainEqual',
    'toHaveLength',
    'toHaveProperty',
    'toMatch',
    'toMatchObject',
    'toBeGreaterThan',
    'toBeGreaterThanOrEqual',
    'toBeLessThan',
    'toBeLessThanOrEqual',
    'toBeCloseTo',
    'toBeInstanceOf',
    'toThrow',
  ];

  const matchers = {} as AsyncMatchers<T>;
  for (const name of names) {
    (matchers as any)[name] = wrap(name);
  }
  Object.defineProperty(matchers, 'not', {
    get: () => createAsyncMatchers(promise, kind, !negated),
  });

  return matchers;
}
