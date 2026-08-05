import { expect as cavyExpect, AssertionError } from '../expect';

describe('expect', () => {
  it('toBe passes on identity and fails otherwise', () => {
    expect(() => cavyExpect(1).toBe(1)).not.toThrow();
    expect(() => cavyExpect(1).toBe(2)).toThrow(AssertionError);
    expect(() => cavyExpect(1).not.toBe(2)).not.toThrow();
    expect(() => cavyExpect(1).not.toBe(1)).toThrow(AssertionError);
  });

  it('toEqual compares deeply', () => {
    expect(() => cavyExpect({ a: [1, { b: 2 }] }).toEqual({ a: [1, { b: 2 }] })).not.toThrow();
    expect(() => cavyExpect({ a: 1 }).toEqual({ a: 2 })).toThrow(AssertionError);
    expect(() => cavyExpect({ a: 1, b: undefined }).toEqual({ a: 1 })).not.toThrow();
  });

  it('toStrictEqual does not ignore undefined properties', () => {
    expect(() => cavyExpect({ a: 1, b: undefined }).toStrictEqual({ a: 1 })).toThrow(
      AssertionError,
    );
  });

  it('truthiness matchers work', () => {
    cavyExpect(1).toBeTruthy();
    cavyExpect(0).toBeFalsy();
    cavyExpect(null).toBeNull();
    cavyExpect(undefined).toBeUndefined();
    cavyExpect('x').toBeDefined();
    cavyExpect(NaN).toBeNaN();
    expect(() => cavyExpect(0).toBeTruthy()).toThrow(AssertionError);
  });

  it('toContain handles strings and arrays', () => {
    cavyExpect('hello world').toContain('world');
    cavyExpect([1, 2, 3]).toContain(2);
    expect(() => cavyExpect([1, 2]).toContain(5)).toThrow(AssertionError);
  });

  it('toContainEqual compares items deeply', () => {
    cavyExpect([{ a: 1 }]).toContainEqual({ a: 1 });
    expect(() => cavyExpect([{ a: 1 }]).toContainEqual({ a: 2 })).toThrow(AssertionError);
  });

  it('toHaveLength checks the length property', () => {
    cavyExpect([1, 2, 3]).toHaveLength(3);
    cavyExpect('ab').toHaveLength(2);
    expect(() => cavyExpect([1]).toHaveLength(2)).toThrow(AssertionError);
  });

  it('toHaveProperty resolves nested paths', () => {
    cavyExpect({ a: { b: { c: 3 } } }).toHaveProperty('a.b.c');
    cavyExpect({ a: { b: { c: 3 } } }).toHaveProperty('a.b.c', 3);
    expect(() => cavyExpect({ a: 1 }).toHaveProperty('b')).toThrow(AssertionError);
    expect(() => cavyExpect({ a: 1 }).toHaveProperty('a', 2)).toThrow(AssertionError);
  });

  it('toMatch handles strings and RegExps', () => {
    cavyExpect('hello').toMatch('ell');
    cavyExpect('hello').toMatch(/^h.*o$/);
    expect(() => cavyExpect('hello').toMatch(/nope/)).toThrow(AssertionError);
  });

  it('toMatchObject matches subsets', () => {
    cavyExpect({ a: 1, b: { c: 2, d: 3 } }).toMatchObject({ b: { c: 2 } });
    expect(() => cavyExpect({ a: 1 }).toMatchObject({ a: 2 })).toThrow(AssertionError);
  });

  it('numeric comparisons work', () => {
    cavyExpect(3).toBeGreaterThan(2);
    cavyExpect(3).toBeGreaterThanOrEqual(3);
    cavyExpect(2).toBeLessThan(3);
    cavyExpect(2).toBeLessThanOrEqual(2);
    cavyExpect(0.1 + 0.2).toBeCloseTo(0.3);
    expect(() => cavyExpect(1).toBeGreaterThan(2)).toThrow(AssertionError);
  });

  it('toBeInstanceOf checks the prototype chain', () => {
    cavyExpect(new Date()).toBeInstanceOf(Date);
    expect(() => cavyExpect({}).toBeInstanceOf(Date)).toThrow(AssertionError);
  });

  it('toThrow checks thrown errors and messages', () => {
    cavyExpect(() => {
      throw new Error('boom');
    }).toThrow();
    cavyExpect(() => {
      throw new Error('boom');
    }).toThrow('boom');
    cavyExpect(() => {
      throw new Error('boom');
    }).toThrow(/^bo/);
    cavyExpect(() => undefined).not.toThrow();
    expect(() => cavyExpect(() => undefined).toThrow()).toThrow(AssertionError);
    expect(() => cavyExpect('not a function').toThrow()).toThrow(AssertionError);
  });

  it('resolves awaits and asserts resolved values', async () => {
    await cavyExpect(Promise.resolve(42)).resolves.toBe(42);
    await cavyExpect(Promise.resolve([1])).resolves.toHaveLength(1);
    await expect(cavyExpect(Promise.resolve(1)).resolves.toBe(2)).rejects.toThrow(AssertionError);
    await expect(
      cavyExpect(Promise.reject<number>(new Error('x'))).resolves.toBe(1),
    ).rejects.toThrow('Expected promise to resolve');
  });

  it('rejects awaits and asserts rejection reasons', async () => {
    await cavyExpect(Promise.reject(new Error('nope'))).rejects.toBeInstanceOf(Error);
    await expect(cavyExpect(Promise.resolve(1)).rejects.toBeDefined()).rejects.toThrow(
      'Expected promise to reject',
    );
  });
});
