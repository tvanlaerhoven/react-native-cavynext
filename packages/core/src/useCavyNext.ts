import { useContext } from 'react';

import { TesterContext } from './Tester';
import generateTestHook, { type GenerateTestHook } from './generateTestHook';

// Public: Call `useCavyNext()` in a function component. It returns a function
// that you pass into inner components' refs to add them to the test hook store
// for later use in specs.
//
// Example
//
//   import { useCavyNext } from 'react-native-cavynext';
//
//   export default function SearchBar() {
//     const generateTestHook = useCavyNext();
//     return <TextInput ref={generateTestHook('SearchBar.TextInput')} />;
//   }
//
// Returns the ref generating function for use in function components.
export default function useCavyNext(): GenerateTestHook {
  const testHookStore = useContext(TesterContext);
  return generateTestHook(testHookStore);
}
