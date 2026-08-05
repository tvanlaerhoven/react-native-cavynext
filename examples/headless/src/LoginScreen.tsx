import React, { useState } from 'react';
import { useCavyNext, wrap } from 'react-native-cavynext';

import { Button, Text, TextInput, View } from './primitives';

// `Text`, `TextInput` and `Button` are function components, so they have no
// instance for a ref to point at. `wrap` gives them one that exposes props,
// which is what lets the spec helpers drive them.
const TestableText = wrap(Text);
const TestableTextInput = wrap(TextInput);
const TestableButton = wrap(Button);

export interface LoginScreenProps {
  onLogIn: (email: string) => void;
}

// A function component, hooked with `useCavyNext`.
export default function LoginScreen({ onLogIn }: LoginScreenProps) {
  const generateTestHook = useCavyNext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Your password is too short');
      return;
    }
    setError(null);
    onLogIn(email);
  }

  return (
    // `View` is a class component, so its ref needs no wrapping.
    <View ref={generateTestHook('LoginScreen')}>
      <TestableText ref={generateTestHook('LoginScreen.Title')}>Log in</TestableText>

      <TestableTextInput
        ref={generateTestHook('LoginScreen.EmailInput')}
        value={email}
        placeholder="Email"
        onChangeText={setEmail}
        // Clearing the error on focus gives `spec.focus` something to call.
        onFocus={() => setError(null)}
      />

      <TestableTextInput
        ref={generateTestHook('LoginScreen.PasswordInput')}
        value={password}
        placeholder="Password"
        onChangeText={setPassword}
      />

      <TestableButton
        ref={generateTestHook('LoginScreen.SubmitButton')}
        title="Log in"
        onPress={submit}
      />

      {/* Only hooked while present, so `notExists` is meaningful. */}
      {error && <TestableText ref={generateTestHook('LoginScreen.Error')}>{error}</TestableText>}
    </View>
  );
}
