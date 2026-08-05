# Headless example

A tiny two-screen app driven by real react-native-cavynext specs, with no
simulator and no native toolchain. It runs in Jest as part of `npm test`.

```bash
npm test --workspace examples/headless
```

## Why it exists

- **The docs are executable.** The patterns in the READMEs are used here for
  real, so they can't silently rot.
- **It integration-tests the library.** The unit tests in `packages/core` cover
  each piece in isolation; this example is the only place where a real
  `<Tester>` is mounted, exercising the context plumbing behind `useCavyNext`
  and `hook`, the ref plumbing behind `wrap`, and the re-mount between test
  cases.

It found three genuine bugs: `beforeEach` ran *before* the re-mount that
discarded its work, a failing `beforeEach` aborted the whole run without a
report, and `testID` lookups searched a stale fiber tree, so components mounted
by the latest render were invisible.

It also covers both ways of identifying components, including that an explicit
hook wins over a matching `testID`.

## What's here

| File | Role |
| --- | --- |
| `src/primitives.tsx` | Stand-ins for React Native's `View`, `Text`, `TextInput` and `Button`. |
| `src/LoginScreen.tsx` | A function component, hooked with `useCavyNext` and `wrap`. |
| `src/WelcomeScreen.tsx` | A class component, hooked with the `hook()` HOC. |
| `src/App.tsx` | The app under test: login, then a welcome screen. |
| `src/PlainApp.tsx` | The same idea with **no cavynext code at all** — just `testID` props. |
| `specs/loginSpec.ts` | Validation and a successful login. |
| `specs/welcomeSpec.ts` | Uses `beforeEach` to log in, then drives the welcome screen. |
| `specs/testIDSpec.ts` | Drives `PlainApp` purely by `testID`. |
| `src/__tests__/example.test.tsx` | Mounts `<Tester>` with `react-test-renderer` and asserts every spec passes. |

The only thing that differs from a real project is the last file. In a real app
the CLI plays that role — it boots the app and collects the report over a
websocket:

```bash
npx cavynext run-ios
```

Here a function reporter stands in for the CLI, which is what lets the same
specs run in Jest.

## Note on the primitives

`src/primitives.tsx` exists purely so this example needs no native build. A real
app imports `View`, `Text` and friends from `react-native` and hooks them
exactly as shown here — `wrap` for function and host components, direct refs for
class components.
