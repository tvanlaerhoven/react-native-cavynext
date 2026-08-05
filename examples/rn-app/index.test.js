// The test entry point. The CLI swaps this in for index.js while it runs, then
// swaps it back, so the app itself stays free of test code.
import React from 'react';
import { AppRegistry } from 'react-native';
import { Tester, TestHookStore } from 'react-native-cavynext';

import App from './src/App';
import { name as appName } from './app.json';
import loginSpec from './specs/loginSpec';
import welcomeSpec from './specs/welcomeSpec';

// One store per app. With testID-based lookup nothing registers itself here,
// but the Tester still requires it, and it's what any explicitly hooked
// component would use.
const testHookStore = new TestHookStore();

function TestableApp() {
  return (
    <Tester
      specs={[loginSpec, welcomeSpec]}
      store={testHookStore}
      // How long to wait for a component to appear before failing.
      waitTime={1000}
      // Give the app a moment to finish booting before the first test runs.
      startDelay={2000}
    >
      <App />
    </Tester>
  );
}

AppRegistry.registerComponent(appName, () => TestableApp);
