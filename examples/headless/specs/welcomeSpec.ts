import type { SpecFn } from 'react-native-cavynext';

// A second spec file, to show that specs are independent: each gets its own
// TestScope, and the app is re-mounted between test cases.
const welcomeSpec: SpecFn = (spec) => {
  // Every test case in this spec starts from the welcome screen.
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

      await spec.waitFor(async () => {
        const likes = await spec.findComponent('WelcomeScreen.Likes');
        return likes.props?.children === 'Likes: 2';
      });
    });

    spec.it('resets the likes on a long press', async () => {
      await spec.press('WelcomeScreen.LikeButton');
      await spec.longPress('WelcomeScreen.LikeButton');

      await spec.containsText('WelcomeScreen.Likes', 'Likes: 0');
    });

    spec.it('starts from a clean slate, proving the app is re-mounted', async () => {
      // Would be 'Likes: 1' if state leaked from the previous test case.
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
