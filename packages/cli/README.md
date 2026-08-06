# react-native-cavynext-cli

The command line half of [react-native-cavynext](../../README.md). It builds your
app, listens for results from the in-app reporter, prints them, and sets a
meaningful exit code.

```bash
npm install --save-dev react-native-cavynext-cli
```

Migrating from cavy-cli? See [MIGRATION.md](../../MIGRATION.md). Every flag is
unchanged; only the command name is now `cavynext`.

## Commands

```bash
npx cavynext init [specFolderName]   # add cavynext to a project
npx cavynext run-ios
npx cavynext run-android
npx cavynext run-web
npx cavynext run-vega
```

`init` creates a spec folder (`specs` by default) with an example spec, plus an
`index.test.tsx` entry point if you don't already have one.

## How a run works

1. If an `index.test.js` sits next to your `index.js`, they are swapped, so the
   built app boots into the `Tester`. They are always swapped back, even if the
   run is interrupted.
2. The app is built and launched via `npx react-native <command>`, unless you
   pass `--buildCmd` or `--skipbuild`.
3. A report server listens on port **8082**. On Android, `adb reverse` is run so
   a device or emulator can reach it. Only one app instance may report at a
   time; extra connections (e.g. stale browser tabs) are ignored with a
   warning.
4. Results stream in and are printed as they arrive. When the suite finishes, a
   summary (including skipped tests) is printed and the process exits.

## Web (react-native-web)

`run-web` drives a long-running dev server instead of a native build. The
default build command is `npx webpack serve --mode development --open`;
override it with `--buildCmd`. The report server starts immediately, and the
boot timeout catches a server that never serves the app.

Entry files follow the web convention when present: `index.web.js` is swapped
with `index.test.web.js`.

```bash
npx cavynext run-web --buildCmd "npx webpack serve --mode development --config web/webpack.config.js"
```

## Options

Available on every `run-*` command:

| Flag | Description |
| --- | --- |
| `-f, --file <file>` | App entry file. Defaults to `index.js`. |
| `-s, --skipbuild` | Don't build; just listen for results from an already running app. |
| `-b, --buildCmd <cmd>` | Custom build command, instead of the React Native CLI. |
| `-d, --dev` | Keep the server alive after a run, for repeated runs. |
| `-t, --boot-timeout <minutes>` | How long to wait for the app to boot. Defaults to `2`. |
| `--xml` | Write JUnit XML to `cavynext_results.xml`. |
| `--markdown` | Write a markdown summary to `cavynext_results.md`. |
| `--json` | Write a JSON report to `cavynext_results.json`. |
| `--screenshots` | Capture a screenshot after every test result. |

Unknown options are forwarded to the React Native CLI, so this works:

```bash
npx cavynext run-ios --simulator "iPhone 15 Pro"
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every test passed. |
| `42` | Tests ran, but some failed. |
| `1` | Something else went wrong: build failure, app crash, no response before the boot timeout, or port 8082 already in use. |

## Screenshots

Screenshots use `adb exec-out screencap` on Android and `xcrun simctl` on iOS,
and are written to `screenshots/`. Override the folder with the
`CAVYNEXT_SCREENSHOT_DIR` environment variable.

## License

MIT
