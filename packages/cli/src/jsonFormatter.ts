import { writeFileSync } from 'fs';

import type { FullResults } from 'react-native-cavynext';

// Public: Writes the full test report as JSON, for consumption by other
// tooling.
//
// results  - the `fullResults` object from the test report.
// filename - where to write the JSON. Defaults to 'cavynext_results.json'.
export default function constructJSON(
  results: FullResults,
  filename = 'cavynext_results.json',
): void {
  console.log(`Writing results to ${filename}`);

  const testCases = results.testCases;
  const summary = {
    total: testCases.length,
    passed: testCases.filter((r) => r.passed && !r.skipped).length,
    failed: testCases.filter((r) => !r.passed).length,
    skipped: testCases.filter((r) => r.skipped).length,
    duration: results.time,
    timestamp: results.timestamp,
  };

  writeFileSync(filename, `${JSON.stringify({ summary, testCases }, null, 2)}\n`);
}
