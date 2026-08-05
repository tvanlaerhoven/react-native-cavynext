import type { SpecFn } from 'react-native-cavynext';

// Identifiers here are the `testID` props set in src/LoginScreen.tsx. No test
// hooks are needed in the app itself.
const loginSpec: SpecFn = (spec) => {
  spec.describe('Logging in', () => {
    spec.it('shows the login screen on launch', async () => {
      await spec.exists('LoginScreen');
      await spec.containsText('LoginScreen.Title', 'Log in');
      await spec.notExists('LoginScreen.Error');
    });

    spec.it('rejects an invalid email address', async () => {
      await spec.fillIn('LoginScreen.EmailInput', 'nope');
      await spec.fillIn('LoginScreen.PasswordInput', 'a-long-enough-password');
      await spec.press('LoginScreen.SubmitButton');

      await spec.containsText('LoginScreen.Error', 'valid email');
      await spec.exists('LoginScreen');
    });

    spec.it('rejects a short password', async () => {
      await spec.fillIn('LoginScreen.EmailInput', 'amy@example.com');
      await spec.fillIn('LoginScreen.PasswordInput', 'short');
      await spec.press('LoginScreen.SubmitButton');

      await spec.containsText('LoginScreen.Error', 'too short');
    });

    spec.it('logs in with valid credentials', async () => {
      await spec.fillIn('LoginScreen.EmailInput', 'amy@example.com');
      await spec.fillIn('LoginScreen.PasswordInput', 'a-long-enough-password');
      await spec.press('LoginScreen.SubmitButton');

      await spec.exists('WelcomeScreen');
      await spec.containsText('WelcomeScreen.Greeting', 'amy@example.com');
      await spec.notExists('LoginScreen');
    });
  });
};

export default loginSpec;
