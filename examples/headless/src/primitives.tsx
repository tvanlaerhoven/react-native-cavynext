import React from 'react';

// Stand-ins for the React Native components a real app would import.
//
// The point of this example is to exercise cavynext without a native
// toolchain, so these render neutral host elements instead of native views.
// Everything else - how they're hooked, how specs drive them - is identical to
// a real app.

export interface ViewProps {
  children?: React.ReactNode;
  style?: Record<string, unknown> | Record<string, unknown>[];
  testID?: string;
}

// A class component, mirroring how React Native's View gives a ref an instance
// that already exposes `props`. Class components need no `wrap`.
export class View extends React.Component<ViewProps> {
  override render() {
    return (
      <cn-view style={this.props.style} testID={this.props.testID}>
        {this.props.children}
      </cn-view>
    );
  }
}

export interface TextProps {
  children?: React.ReactNode;
  testID?: string;
}

// A function component, so it must be `wrap`ped before a hook can read its
// props. This mirrors wrapping React Native's `Text`.
//
// Note that `wrap` is only needed for the ref-based API. A `testID` is found by
// searching the component tree, so it needs no wrapping at all.
export function Text({ children, testID }: TextProps) {
  return <cn-text testID={testID}>{children}</cn-text>;
}

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  testID?: string;
}

export function TextInput({ value, placeholder, onChangeText, onFocus, testID }: TextInputProps) {
  return (
    <cn-input
      value={value}
      placeholder={placeholder}
      onChangeText={onChangeText}
      onFocus={onFocus}
      testID={testID}
    />
  );
}

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
}

export function Button({ title, onPress, onLongPress, testID }: ButtonProps) {
  return (
    <cn-button onPress={onPress} onLongPress={onLongPress} testID={testID}>
      {title}
    </cn-button>
  );
}

// The host elements above aren't in React's JSX namespace, so declare them.
// They're prefixed to avoid clashing with the DOM and SVG element types that
// come with the React typings. A real app renders React Native components and
// needs none of this.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'cn-view': any;
      'cn-text': any;
      'cn-input': any;
      'cn-button': any;
    }
  }
}
