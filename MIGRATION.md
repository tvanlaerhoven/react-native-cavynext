# Migrating from Cavy to react-native-cavynext

The spec API, the hooking model and the CLI workflow are all unchanged, so most
projects migrate with a dependency swap and a find-and-replace of the import
path. This guide covers that path, then the handful of cases that need a real
change.

## 1. Swap the packages

```bash
npm uninstall cavy cavy-cli
npm install --save-dev react-native-cavynext react-native-cavynext-cli
```

## 2. Rename the imports

Every export Cavy had is exported under the same name, so only the module path
changes:

```diff
-import { Tester, TestHookStore, hook, useCavy, wrap } from 'cavy';
+import { Tester, TestHookStore, hook, useCavy, wrap } from 'react-native-cavynext';
```

A one-shot replace over your source tree:

```bash
grep -rl "from 'cavy'" src | xargs sed -i '' "s/from 'cavy'/from 'react-native-cavynext'/g"
```

`useCavy` is kept as an alias of `useCavyNext`, so your components need no
further edits. New code can use either name.

## 3. Rename the CLI commands

```diff
-npx cavy run-ios
-npx cavy run-android
+npx cavynext run-ios
+npx cavynext run-android
```

Every flag Cavy's CLI accepted still works (`-f/--file`, `-d/--dev`,
`-s/--skipbuild`, `-b/--buildCmd`, `-t/--boot-timeout`, `--xml`). See
[the CLI options](#cli-additions) for what is new.

Your `index.test.js` entry file, the `specs/` folder and the report server port
(8082) are all unchanged.

## 4. Things that actually changed

### `clearAsyncStorage` needs a `storage` prop

Cavy imported `AsyncStorage` from `react-native`, which no longer exists in
modern React Native. Inject your implementation instead:

```diff
+import AsyncStorage from '@react-native-async-storage/async-storage';
+
 <Tester
   specs={[MyFeatureSpec]}
   store={testHookStore}
-  clearAsyncStorage
+  clearStorage
+  storage={AsyncStorage}
 >
```

`clearAsyncStorage` is still accepted so an existing `<Tester>` keeps working,
but it does nothing without `storage`, and a warning is logged.

### `sendReport` is gone

Cavy needed `sendReport` to decide whether to send results. A report is now sent
whenever the CLI's report server is listening, so the prop is ignored and warns.
Delete it:

```diff
-<Tester specs={[MyFeatureSpec]} store={testHookStore} sendReport />
+<Tester specs={[MyFeatureSpec]} store={testHookStore} />
```

### A second `beforeEach` no longer breaks

Cavy assigned your function onto `spec.beforeEach` itself, so calling
`beforeEach` twice in one spec threw. It is now stored separately. If you worked
around this, you can drop the workaround.

### Custom reporters

The reporter contract is unchanged for plain functions:

```ts
<Tester specs={specs} store={store} reporter={(report) => upload(report)} />
```

Realtime and deferred reporter objects are also supported; see the README.

## 5. Type your specs (optional)

The library ships its own types, so `@types/cavy` is no longer needed and a spec
can be typed directly:

```ts
import type { SpecFn } from 'react-native-cavynext';

const spec: SpecFn = (spec) => {
  spec.describe('Logging in', () => {
    spec.it('works', async () => {
      await spec.fillIn('LoginScreen.EmailInput', 'test@example.com');
      await spec.press('LoginScreen.Button');
      await spec.exists('WelcomeScreen');
    });
  });
};

export default spec;
```

## Optional: drop the test hooks entirely

Your existing hooks keep working, and nothing below is required.

Cavy could only find a component that had opted in with a `ref`, which meant test
code in your production components — and `wrap()` around every function or host
component. Specs can now identify components by their ordinary `testID` prop
instead, so this:

```tsx
const TestableText = wrap(Text);

export default function Title({ title }) {
  const generateTestHook = useCavy();
  return <TestableText ref={generateTestHook('Title.text')}>{title}</TestableText>;
}
```

becomes:

```tsx
export default function Title({ title }) {
  return <Text testID="Title.text">{title}</Text>;
}
```

The spec is unchanged. Hooked components take precedence over a matching
`testID`, so you can migrate a screen at a time, and adding a `testID` can never
change what an existing spec means.

This walks React's fiber tree, which is not a public API. It is written
defensively — if React's internals change, `testID` lookups degrade to "not
found" and test hooks keep working. Turn it off with
`<Tester useTestIDs={false} ...>`.

## CLI additions

Available once you've migrated, none of them required:

| Flag | What it does |
| --- | --- |
| `--markdown` | Writes a markdown summary table, handy for CI job summaries. |
| `--screenshots` | Captures a screenshot after every test result. Cavy's CLI did this unconditionally. |

## Spec API additions

| Helper | What it does |
| --- | --- |
| `spec.waitFor(predicate, timeout?)` | Polls until a condition holds, for waits that aren't "a component appeared". |
| `spec.expectVisible(id)` | Asserts a component is present *and* not hidden by `display: 'none'` or `opacity: 0`. |
| `spec.scrollTo(id, offset)` | Scrolls a `ScrollView`/`FlatList`, preferring its imperative `scrollTo`. |
| `spec.longPress(id)` | Calls `onLongPress`. |
| `spec.changeText(id, str)` | Alias of `fillIn`, named after the prop it calls. |

## Behaviour differences worth knowing

- **Failure exit code.** The CLI exits `42` when tests ran but failed, and `1`
  when something went wrong (build failure, app crash, port clash). Cavy's CLI
  used `1` for both, so CI can now tell them apart. If your pipeline checks for
  a non-zero exit code, nothing changes.
- **Component-not-found errors** now list the identifiers that *are* hooked,
  which usually points straight at a typo.
- **JUnit XML** reports the real test count. Cavy's CLI always wrote
  `tests="undefined"`.
- **Your own refs are preserved.** Passing a ref to `generateTestHook` no longer
  risks the hook silently stealing it.
