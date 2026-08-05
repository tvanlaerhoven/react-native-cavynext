import React, { useState } from 'react';

import LoginScreen from './LoginScreen';
import WelcomeScreen from './WelcomeScreen';

// The app under test: a two-screen flow, with no knowledge of cavynext beyond
// the hooks its screens attach to their own components.
export default function App() {
  const [email, setEmail] = useState<string | null>(null);

  if (email) {
    return <WelcomeScreen email={email} onLogOut={() => setEmail(null)} />;
  }

  return <LoginScreen onLogIn={setEmail} />;
}
