import React, { useState } from 'react';

import { Button, Text, TextInput, View } from './primitives';

// An app with *no* cavynext code in it at all.
//
// Note what's missing compared to LoginScreen: no `useCavyNext`, no `wrap`, no
// `hook`, no refs. The only thing the specs rely on is `testID`, which many apps
// already set for accessibility or other test tooling.
//
// Specs find these components by searching the rendered tree for a matching
// `testID`, so nothing here is test-specific.
export default function PlainApp() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);

  return (
    <View testID="SignUp">
      <Text testID="SignUp.Title">Sign up</Text>

      <TextInput
        testID="SignUp.NameInput"
        value={name}
        placeholder="Your name"
        onChangeText={setName}
      />

      <Button
        testID="SignUp.SubmitButton"
        title="Greet me"
        onPress={() => setGreeting(name ? `Hello, ${name}` : 'Hello, stranger')}
        onLongPress={() => setGreeting(null)}
      />

      {greeting && <Text testID="SignUp.Greeting">{greeting}</Text>}
    </View>
  );
}
