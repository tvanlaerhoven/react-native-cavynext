// Internal: File templates written by `cavynext init`.

// Internal: The test entry point, which boots the app wrapped in a Tester.
export function indexTestTemplate(specFolderName: string, appName = 'yourAppName'): string {
  return `import React from 'react';
import { AppRegistry, Platform } from 'react-native';
import { Tester, TestHookStore } from 'react-native-cavynext';

import App from './App';
import ExampleSpec from './${specFolderName}/exampleSpec';

// One store per app; it holds every hooked component.
const testHookStore = new TestHookStore();

function AppWrapper() {
  return (
    <Tester specs={[ExampleSpec]} store={testHookStore}>
      <App />
    </Tester>
  );
}

AppRegistry.registerComponent('${appName}', () => AppWrapper);

if (Platform.OS === 'web') {
  AppRegistry.runApplication('${appName}', {
    rootTag: document.getElementById('root'),
  });
}
`;
}

// Internal: An example spec showing the constructs available.
export function exampleSpecTemplate(): string {
  return `import type { SpecFn } from 'react-native-cavynext';

const spec: SpecFn = (spec) => {
  spec.describe('Logging in', () => {
    spec.it('works', async () => {
      await spec.exists('LoginScreen');
      await spec.fillIn('LoginScreen.EmailInput', 'test@example.com');
      await spec.fillIn('LoginScreen.PasswordInput', 'password');
      await spec.press('LoginScreen.Button');
      await spec.exists('WelcomeScreen');
    });
  });
};

export default spec;
`;
}
