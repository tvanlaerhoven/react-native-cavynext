import type { SpecFn } from 'react-native-cavynext';

const welcomeSpec: SpecFn = (spec) => {
  // Every test case in this spec starts logged in.
  spec.beforeEach(async () => {
    await spec.fillIn('LoginScreen.EmailInput', 'jim@example.com');
    await spec.fillIn('LoginScreen.PasswordInput', 'a-long-enough-password');
    await spec.press('LoginScreen.SubmitButton');
    await spec.exists('WelcomeScreen');
  });

  spec.describe('The welcome screen', () => {
    spec.it('starts with no likes', async () => {
      await spec.containsText('WelcomeScreen.Likes', 'Likes: 0');
      await spec.expectVisible('WelcomeScreen.LikeButton');
    });

    spec.it('counts likes', async () => {
      await spec.press('WelcomeScreen.LikeButton');
      await spec.press('WelcomeScreen.LikeButton');

      await spec.containsText('WelcomeScreen.Likes', 'Likes: 2');
    });

    spec.it('resets the likes on a long press', async () => {
      await spec.press('WelcomeScreen.LikeButton');
      await spec.longPress('WelcomeScreen.LikeButton');

      await spec.containsText('WelcomeScreen.Likes', 'Likes: 0');
    });

    spec.it('logs out', async () => {
      await spec.press('WelcomeScreen.LogOutButton');

      await spec.exists('LoginScreen');
      await spec.notExists('WelcomeScreen');
    });
  });
};

export default welcomeSpec;
