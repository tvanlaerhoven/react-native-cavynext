# react-native-cavynext

An integration test framework for React Native, in the spirit of
[Cavy](https://github.com/pixielabs/cavy): you hook the components you care
about, then drive them from specs that run inside your real app on a real device
or simulator.

This is a TypeScript rewrite of Cavy and cavy-cli, kept deliberately
API-compatible. **Coming from Cavy? See [MIGRATION.md](./MIGRATION.md)** — in
most projects it is a dependency swap and a find-and-replace of the import path.

## Packages

| Package | Description |
| --- | --- |
| [`react-native-cavynext`](./packages/core) | The library you add to your app: `Tester`, `TestHookStore`, `hook`, `wrap`, `useCavyNext` and the spec API. |
| [`react-native-cavynext-cli`](./packages/cli) | The `cavynext` command that builds your app, collects results and reports them. |

## Install

```bash
npm install --save-dev react-native-cavynext react-native-cavynext-cli
```

Then scaffold a spec folder and a test entry point:

```bash
npx cavynext init
```

## Quickstart

**1. Give the components you want to test a `testID`.** That's ordinary React
Native — no cavynext imports, no refs:

```tsx
import { Pressable, Text, TextInput, View } from 'react-native';

export default function LoginScreen({ onSubmit }) {
  return (
    <View testID="LoginScreen">
      <TextInput testID="LoginScreen.EmailInput" onChangeText={setEmail} />
      <Pressable testID="LoginScreen.Button" onPress={onSubmit}>
        <Text>Log in</Text>
      </Pressable>
    </View>
  );
}
```

Prefer explicit test hooks, as Cavy had? Use `useCavyNext()` in function
components or `hook()` in class components and pass the result into a `ref`. Both
styles work, specs look identical, and hooks win over a matching `testID`. See
[the library README](./packages/core/README.md#two-ways-to-identify-components).

**2. Write a spec.**

```ts
// specs/LoginSpec.ts
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

**3. Wrap your app in a `Tester`** from a test entry point named
`index.test.js`, sitting next to your real `index.js`:

```tsx
// index.test.js
import React from 'react';
import { AppRegistry } from 'react-native';
import { Tester, TestHookStore } from 'react-native-cavynext';

import App from './App';
import LoginSpec from './specs/LoginSpec';

const testHookStore = new TestHookStore();

function AppWrapper() {
  return (
    <Tester specs={[LoginSpec]} store={testHookStore}>
      <App />
    </Tester>
  );
}

AppRegistry.registerComponent('yourAppName', () => AppWrapper);
```

**4. Run the specs.** The CLI swaps your test entry point in, builds the app,
and waits for results:

```bash
npx cavynext run-ios
npx cavynext run-android
```

The command exits `0` when everything passed, `42` when tests failed, and `1`
when something went wrong (build failure, app crash, port already in use), so CI
can tell a test failure apart from a broken build.

## Examples

| Example | Description |
| --- | --- |
| [`examples/headless`](./examples/headless) | A small app driven by specs in Jest, no simulator needed. Runs in `npm test`, and covers both the `testID` and test-hook styles. |
| [`examples/rn-app`](./examples/rn-app) | A real React Native app run with `npx cavynext run-ios`. Needs a native toolchain, so it is not verified by CI. |

## Documentation

- [Library API and spec helpers](./packages/core/README.md)
- [CLI commands and flags](./packages/cli/README.md)
- [Migrating from Cavy](./MIGRATION.md)

## Working on this repo

This is an npm workspaces monorepo.

```bash
npm install          # install every workspace
npm run build        # compile both packages
npm test             # run the core unit tests
npm run typecheck    # typecheck without emitting
npm run lint         # eslint
npm run format       # prettier --write
```

To exercise the CLI's report loop without a simulator, start the report server
and point the bundled fake app at it:

```bash
node packages/cli/bin/cavynext.js run-web --xml --markdown
node packages/cli/scripts/fakeApp.js --fail
```

## License

MIT
