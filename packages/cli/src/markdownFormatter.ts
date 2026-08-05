import { writeFileSync } from 'fs';

import type { FullResults } from 'react-native-cavynext';

// Public: Writes a markdown summary table of the run, suitable for pasting
// into a pull request or a CI job summary.
//
// results  - the `fullResults` object from the test report.
// filename - where to write the markdown. Defaults to 'cavynext_results.md'.
export default function constructMarkdown(
  results: FullResults,
  filename = 'cavynext_results.md',
): void {
  console.log(`Writing results to ${filename}`);

  const rows = results.testCases
    .map((result) => `|${result.description}|${result.passed ? '✅' : '❌'}|${result.time}s|`)
    .join('\n');

  const data =
    '### E2E Test Summary\n' +
    '|Description 📝|Test result 🧪|Duration ⏰|\n' +
    '|---|---|---|\n' +
    `${rows}\n`;

  writeFileSync(filename, data);
}
