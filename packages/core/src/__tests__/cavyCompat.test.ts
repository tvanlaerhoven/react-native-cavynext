import Cavynext, {
  Tester,
  TestHookStore,
  TestScope,
  generateTestHook,
  hook,
  useCavy,
  useCavyNext,
  wrap,
} from '../index';

// Guards the migration path documented in MIGRATION.md: everything Cavy
// exported must keep working under the same name, so that swapping the import
// path is enough.
describe('Cavy compatibility', () => {
  it('exports every name Cavy exported', () => {
    for (const exported of [Tester, TestHookStore, hook, wrap, useCavy, generateTestHook]) {
      expect(exported).toBeDefined();
    }
  });

  it('keeps `useCavy` as an alias of `useCavyNext`', () => {
    expect(useCavy).toBe(useCavyNext);
  });

  it('exposes the same names on the default export', () => {
    expect(Cavynext.Tester).toBe(Tester);
    expect(Cavynext.useCavy).toBe(useCavy);
    expect(Cavynext.wrap).toBe(wrap);
  });

  it('supports a spec written against Cavy, including `this`-style calls', async () => {
    // Cavy invoked test bodies with the TestScope as `this`, and plenty of
    // specs in the wild rely on that instead of the `spec` argument.
    const store = new TestHookStore();
    const spec = new TestScope(store, 200);
    const pressed: string[] = [];
    store.add('Scene.button', { props: { onPress: () => pressed.push('pressed') } });

    spec.describe('A Cavy spec', function () {
      spec.it('runs', async function () {
        await this.press('Scene.button');
      });
    });

    const testCase = spec.testCases[0];
    await testCase.f.call(spec);

    expect(pressed).toEqual(['pressed']);
  });
});
