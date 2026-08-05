import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import LoginScreen from './LoginScreen';
import WelcomeScreen from './WelcomeScreen';

// The app under test. It has no idea cavynext exists.
export default function App() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      {email ? (
        <WelcomeScreen email={email} onLogOut={() => setEmail(null)} />
      ) : (
        <LoginScreen onLogIn={setEmail} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
