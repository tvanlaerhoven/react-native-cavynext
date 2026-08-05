# React Native example app

A real React Native app driven by cavynext specs on a simulator or device.

**The app contains no test code.** No cavynext imports, no refs, no wrapping —
components are identified by their ordinary `testID` prop. The only
test-specific file is `index.test.js`, which the CLI swaps in for `index.js`
while it runs.

> **Not verified end to end.** Unlike `examples/headless`, this needs a native
> toolchain and a booted simulator, so it hasn't been run. The JavaScript side
> mirrors the headless example, which is covered by tests. Treat the native
> setup below as untested.

## Setup

This folder holds only the JavaScript side. Native projects are large,
machine-specific and quickly go stale, so generate them:

```bash
cd examples/rn-app
npx @react-native-community/cli init CavynextRnExample --directory . --skip-install --title "cavynext example"
```

Answer "no" when it offers to overwrite `package.json`, `index.js`, `app.json`,
`babel.config.js` or `metro.config.js` — the versions here are already wired up.
Then:

```bash
npm install
cd ios && pod install && cd ..   # iOS only
```

## Run the app normally

```bash
npm run ios       # or: npm run android
```

## Run the specs

```bash
npx cavynext run-ios       # or: npx cavynext run-android
```

The CLI moves `index.js` aside, puts `index.test.js` in its place, builds and
launches the app, collects results over a websocket, prints them, and restores
your entry point — even if the run is interrupted.

Useful flags:

```bash
npx cavynext run-ios --xml --markdown        # write report files
npx cavynext run-ios --skipbuild             # app already running
npx cavynext run-ios --simulator "iPhone 15 Pro"
```

Exit codes: `0` all passed, `42` tests failed, `1` something broke.

## What's here

| File | Role |
| --- | --- |
| `index.js` | Normal entry point. |
| `index.test.js` | Test entry point: wraps `<App />` in `<Tester>`. |
| `src/App.tsx` | Login screen, then a welcome screen. |
| `src/LoginScreen.tsx` | Function component, `testID`s only. |
| `src/WelcomeScreen.tsx` | Class component, `testID`s only. |
| `specs/loginSpec.ts` | Validation and a successful login. |
| `specs/welcomeSpec.ts` | Uses `beforeEach` to log in first. |

## Why `testID` and not test hooks

Both work, and specs are written identically either way.

- **`testID`** keeps the app clean. Components are found by searching the
  rendered tree. Best when you already set `testID`s, or don't want test
  concerns in production components.
- **`generateTestHook`** (Cavy's original approach) needs a ref in your
  component, and `wrap()` around function or host components. Worth it when a
  component has no sensible `testID`, or when you want lookups that don't depend
  on React internals.

Hooked components always win over a matching `testID`, so the two can be mixed
freely. See `examples/headless` for the hook-based style.

## Monorepo linking

`package.json` points at `file:../../packages/core` and `file:../../packages/cli`,
and `metro.config.js` adds the sibling packages to Metro's watch folders while
pinning a single copy of React and React Native. A standalone app installs from
npm and needs none of that.

This example is deliberately **not** an npm workspace of the monorepo: a real RN
app pins its own React version, which would clash with the root install.
