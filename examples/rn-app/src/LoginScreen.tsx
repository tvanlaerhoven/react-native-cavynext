import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

// Ordinary application code: no cavynext imports, no refs, no wrapping.
//
// The specs locate these components by their `testID`, which is a plain React
// Native prop that also feeds accessibility tooling.

export interface LoginScreenProps {
  onLogIn: (email: string) => void;
}

export default function LoginScreen({ onLogIn }: LoginScreenProps) {
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
    <View style={styles.container} testID="LoginScreen">
      <Text style={styles.title} testID="LoginScreen.Title">
        Log in
      </Text>

      <TextInput
        testID="LoginScreen.EmailInput"
        style={styles.input}
        value={email}
        placeholder="Email"
        autoCapitalize="none"
        onChangeText={setEmail}
        onFocus={() => setError(null)}
      />

      <TextInput
        testID="LoginScreen.PasswordInput"
        style={styles.input}
        value={password}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
      />

      <Pressable testID="LoginScreen.SubmitButton" style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>Log in</Text>
      </Pressable>

      {error && (
        <Text style={styles.error} testID="LoginScreen.Error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});
