import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// A class component, to show that identifying by `testID` works regardless of
// how the component is written. There is no `hook()` HOC and no injected prop.

export interface WelcomeScreenProps {
  email: string;
  onLogOut: () => void;
}

interface WelcomeScreenState {
  likes: number;
}

export default class WelcomeScreen extends React.Component<WelcomeScreenProps, WelcomeScreenState> {
  override state: WelcomeScreenState = { likes: 0 };

  override render() {
    const { email, onLogOut } = this.props;

    return (
      <View style={styles.container} testID="WelcomeScreen">
        <Text style={styles.title} testID="WelcomeScreen.Greeting">
          {`Welcome, ${email}`}
        </Text>

        <Text testID="WelcomeScreen.Likes">{`Likes: ${this.state.likes}`}</Text>

        <Pressable
          testID="WelcomeScreen.LikeButton"
          style={styles.button}
          onPress={() => this.setState(({ likes }) => ({ likes: likes + 1 }))}
          onLongPress={() => this.setState({ likes: 0 })}
        >
          <Text style={styles.buttonText}>Like</Text>
        </Pressable>

        <Pressable
          testID="WelcomeScreen.LogOutButton"
          style={styles.secondaryButton}
          onPress={onLogOut}
        >
          <Text style={styles.secondaryButtonText}>Log out</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
});
