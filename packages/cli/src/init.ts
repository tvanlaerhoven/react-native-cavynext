import { existsSync, mkdirSync, writeFileSync } from 'fs';

import { exampleSpecTemplate, indexTestTemplate } from './templates';

// Internal: Used to check we're being run from inside an RN project.
const REACT_NATIVE_PATH = 'node_modules/react-native';
const DEFAULT_SPEC_DIR = 'specs';
const DEFAULT_ENTRY_FILE = 'index.test.tsx';

// Internal: Rejects characters that are reserved in filenames on Unix-like
// systems or Windows.
function folderNameInvalid(name: string): boolean {
  return /[<>:"/\\|?*]/g.test(name);
}

// Internal: Create the spec folder, an example spec, and the test entry point.
function setUp(specFolderName?: string): void {
  console.log('cavynext: adding cavynext to your project...');

  const folderName = specFolderName || DEFAULT_SPEC_DIR;

  if (folderNameInvalid(folderName)) {
    console.log('cavynext: folder name invalid. Please remove any reserved characters: <>:"/\\|?*');
    process.exit(1);
  }

  if (existsSync(folderName)) {
    console.log(`cavynext: a ./${folderName} directory already exists for this project.`);
    console.log(
      'cavynext: to continue, re-run with a different spec directory name: `cavynext init <dir>`',
    );
    process.exit(1);
  }

  mkdirSync(`./${folderName}`);
  writeFileSync(`./${folderName}/exampleSpec.ts`, exampleSpecTemplate());

  // Never overwrite an existing test entry point.
  if (existsSync(DEFAULT_ENTRY_FILE)) {
    console.log(`cavynext: ${DEFAULT_ENTRY_FILE} already exists, skipping this step.`);
  } else {
    writeFileSync(DEFAULT_ENTRY_FILE, indexTestTemplate(folderName));
  }

  console.log('cavynext: done!');
  process.exit(0);
}

// Public: Checks you're inside a React Native project, then sets cavynext up.
export default function init(specFolderName?: string): void {
  if (!existsSync(REACT_NATIVE_PATH)) {
    console.log(
      "cavynext: make sure you're inside a React Native project and that you've run npm install.",
    );
    process.exit(1);
  }

  setUp(specFolderName);
}
