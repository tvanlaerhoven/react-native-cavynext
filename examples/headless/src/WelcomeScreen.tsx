import React from 'react';
import { hook, wrap, type GenerateTestHook } from 'react-native-cavynext';

import { Button, Text, View } from './primitives';

const TestableText = wrap(Text);
const TestableButton = wrap(Button);

export interface WelcomeScreenProps {
  email: string;
  onLogOut: () => void;
  // Injected by `hook()`, so callers never pass it.
  generateTestHook: GenerateTestHook;
}

interface WelcomeScreenState {
  likes: number;
}

// A class component, hooked with the `hook()` higher-order component. Class
// components can't use the `useCavyNext` hook, so this is the other half of the
// API surface.
class WelcomeScreen extends React.Component<WelcomeScreenProps, WelcomeScreenState> {
  override state: WelcomeScreenState = { likes: 0 };

  override render() {
    const { email, onLogOut, generateTestHook } = this.props;

    return (
      <View ref={generateTestHook('WelcomeScreen')}>
        <TestableText ref={generateTestHook('WelcomeScreen.Greeting')}>
          {`Welcome, ${email}`}
        </TestableText>

        <TestableText ref={generateTestHook('WelcomeScreen.Likes')}>
          {`Likes: ${this.state.likes}`}
        </TestableText>

        <TestableButton
          ref={generateTestHook('WelcomeScreen.LikeButton')}
          title="Like"
          onPress={() => this.setState(({ likes }) => ({ likes: likes + 1 }))}
          onLongPress={() => this.setState({ likes: 0 })}
        />

        <TestableButton
          ref={generateTestHook('WelcomeScreen.LogOutButton')}
          title="Log out"
          onPress={onLogOut}
        />
      </View>
    );
  }
}

export default hook(WelcomeScreen);
