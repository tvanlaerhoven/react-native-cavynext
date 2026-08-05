import type { SpecFn } from 'react-native-cavynext';

// Specs for an app that contains no cavynext code, identifying components by
// their `testID` prop instead of by an explicit test hook.
//
// The spec API is identical either way - only the app side differs.
const testIDSpec: SpecFn = (spec) => {
  spec.describe('Signing up, found by testID', () => {
    spec.it('finds components that were never hooked', async () => {
      await spec.exists('SignUp');
      await spec.containsText('SignUp.Title', 'Sign up');
      await spec.notExists('SignUp.Greeting');
    });

    spec.it('drives them', async () => {
      await spec.fillIn('SignUp.NameInput', 'Amy');
      await spec.press('SignUp.SubmitButton');

      await spec.containsText('SignUp.Greeting', 'Hello, Amy');
    });

    spec.it('sees fresh props after a re-render', async () => {
      // Proves lookups read the current tree rather than a stale reference:
      // the same identifier must reflect each new value.
      await spec.press('SignUp.SubmitButton');
      await spec.containsText('SignUp.Greeting', 'Hello, stranger');

      await spec.fillIn('SignUp.NameInput', 'Jim');
      await spec.press('SignUp.SubmitButton');
      await spec.containsText('SignUp.Greeting', 'Hello, Jim');
    });

    spec.it('supports long press and disappearance', async () => {
      await spec.press('SignUp.SubmitButton');
      await spec.exists('SignUp.Greeting');

      await spec.longPress('SignUp.SubmitButton');
      await spec.notExists('SignUp.Greeting');
    });
  });
};

export default testIDSpec;
