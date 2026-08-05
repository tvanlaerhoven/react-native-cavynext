# react-native-cavynext

The library half of [react-native-cavynext](../../README.md). Add it to your app,
hook the components you want to drive, and write specs against them.

```bash
npm install --save-dev react-native-cavynext
```

Migrating from Cavy? See [MIGRATION.md](../../MIGRATION.md).

## Two ways to identify components

Specs are written the same either way; only the app side differs.

| Approach | App code needed | Notes |
| --- | --- | --- |
| **`testID`** | None | Components are found by searching the rendered tree for a matching `testID`. |
| **Test hooks** | A ref per component, plus `wrap()` for function and host components | Cavy's original approach. Explicit, and doesn't depend on React internals. |

An explicitly hooked component always wins over a matching `testID`, so the two
can be mixed and adding a `testID` can never change what an existing spec means.

### Using `testID`

Nothing to import. Set `testID` as you normally would:

```tsx
export default function LoginScreen({ onSubmit }) {
  return (
    <View testID="LoginScreen">
      <TextInput testID="LoginScreen.EmailInput" onChangeText={setEmail} />
      <Pressable testID="LoginScreen.Button" onPress={onSubmit}>
        <Text>Log in</Text>
      </Pressable>
    </View>
  );
}
```

Then refer to those IDs from a spec exactly as you would a hooked component:

```ts
await spec.fillIn('LoginScreen.EmailInput', 'test@example.com');
await spec.press('LoginScreen.Button');
```

Turn it off with `<Tester useTestIDs={false} ...>`.

**Caveats.** This walks React's fiber tree, which is not a public API, so it's
written defensively — if React's internals change, `testID` lookups degrade to
"not found" and test hooks keep working. If the same `testID` appears more than
once, the outermost match wins.

## Hooking components

### `useCavyNext()`

For function components. Returns `generateTestHook`, which you pass into a
`ref`:

```tsx
import { useCavyNext } from 'react-native-cavynext';

export default function SearchBar() {
  const generateTestHook = useCavyNext();
  return <TextInput ref={generateTestHook('SearchBar.TextInput')} />;
}
```

Your own ref is always preserved, either as a callback or as a `useRef` object:

```tsx
<TextInput ref={generateTestHook('SearchBar.TextInput', inputRef)} />
```

`useCavy` is exported as an alias, for compatibility with Cavy.

### `hook(Component)`

For class components. Supplies `generateTestHook` as a prop:

```tsx
import { hook } from 'react-native-cavynext';

class MyComponent extends React.Component {
  render() {
    const { generateTestHook } = this.props;
    return <Button ref={generateTestHook('MyComponent.button')} title="Press me" />;
  }
}

export default hook(MyComponent);
```

### `wrap(Component)`

Only needed for the ref-based API — a `testID` needs no wrapping.

Function components and host components like `Text` don't expose their props
through a ref, so the spec helpers can't reach them. `wrap` fixes that:

```tsx
import { Text } from 'react-native';
import { useCavyNext, wrap } from 'react-native-cavynext';

const TestableText = wrap(Text);

export default function Title({ title }) {
  const generateTestHook = useCavyNext();
  return <TestableText ref={generateTestHook('Title.text')}>{title}</TestableText>;
}
```

Class components need no wrapping.

## The `Tester` component

Wrap your whole app in it from your test entry point.

| Prop | Type | Description |
| --- | --- | --- |
| `store` | `TestHookStore` | **Required.** The store holding your hooked components. |
| `specs` | `SpecFn[]` | **Required.** Your spec functions. |
| `reporter` | reporter, class or function | Defaults to `WebSocketReporter`, which reports to the CLI. |
| `waitTime` | `number` | How long `findComponent` waits for a component, in ms. Defaults to `2000`. |
| `startDelay` | `number` | How long to wait before starting, in ms. Defaults to `0`. |
| `only` | `string[]` | Run only test cases carrying one of these tags. |
| `clearStorage` | `boolean` | Clear `storage` between test cases. Defaults to `false`. |
| `storage` | `Storage` | Your AsyncStorage implementation, required by `clearStorage`. |
| `useTestIDs` | `boolean` | Allow specs to find components by `testID`. Defaults to `true`. |

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

<Tester specs={specs} store={store} clearStorage storage={AsyncStorage}>
  <App />
</Tester>;
```

## Spec API

A spec is a function receiving a `TestScope`. Every helper returns a promise, so
`await` them.

### Structure

| Helper | Description |
| --- | --- |
| `describe(label, fn, tag?)` | Group test cases. An optional tag can be matched by the Tester's `only`. |
| `it(label, fn, tag?)` | Define a test case. Inherits its `describe` block's tag. |
| `beforeEach(fn)` | Run something before every test case in the spec. |

### Actions

| Helper | Description |
| --- | --- |
| `fillIn(id, str)` | Calls `onChangeText`. Also available as `changeText`. |
| `press(id)` | Calls `onPress`. |
| `longPress(id)` | Calls `onLongPress`. |
| `focus(id)` | Calls `onFocus`. |
| `scrollTo(id, { x, y })` | Scrolls a `ScrollView`/`FlatList`, preferring its imperative `scrollTo`. |
| `pause(ms)` | Waits for a fixed time. |
| `waitFor(predicate, timeout?)` | Polls until a condition holds. Rejects with a `TimeoutError`. |

### Assertions

| Helper | Description |
| --- | --- |
| `exists(id)` | Resolves `true` if the component is present. |
| `notExists(id)` | Resolves `true` if it is absent. Waits the full `waitTime`. |
| `expectVisible(id)` | Also fails if the component is hidden via `display: 'none'` or `opacity: 0`. |
| `containsText(id, text)` | Checks the component's children contain `text`. |
| `findComponent(id)` | Returns the hooked component itself, for anything custom. |

Errors are typed, so you can tell them apart: `ComponentNotFoundError`,
`MissingPropError`, `UnwrappedComponentError`, `TimeoutError`.

## Custom reporters

The simplest reporter is a function receiving the final report:

```tsx
<Tester specs={specs} store={store} reporter={(report) => upload(report)} />
```

For results as they happen, implement `RealtimeReporter`:

```ts
import type { RealtimeReporter } from 'react-native-cavynext';

const reporter: RealtimeReporter = {
  type: 'realtime',
  onStart: () => openConnection(),
  send: (result) => stream(result),
  onFinish: (report) => finish(report),
};
```

`DeferredReporter` (`type: 'deferred'`) receives only the final report.

## License

MIT
