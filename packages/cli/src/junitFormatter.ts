import { writeFileSync } from 'fs';
import os from 'os';

import { Builder } from 'xml2js';
import type { FullResults, TestResult } from 'react-native-cavynext';

// Private: Returns a failure XML element, with the required attributes.
function formattedTestError(test: TestResult) {
  return {
    $: {
      message: test.errorMessage,
      // There is only one kind of failure at the moment.
      type: 'cavynext test failure',
    },
  };
}

// Private: Returns a testcase XML element, with the required attributes.
function formattedTestCase(test: TestResult) {
  const formattedTest: Record<string, unknown> = {
    $: {
      classname: test.describeLabel,
      name: test.description,
      time: test.time,
    },
  };

  // If the test failed, add a nested failure element.
  if (test.errorMessage) {
    formattedTest.failure = formattedTestError(test);
  }
  return formattedTest;
}

// Public: Takes an aggregated result object and writes it out as XML following
// the JUnit reporting conventions, so CI systems can display the results.
//
// results  - the `fullResults` object from the test report.
// filename - where to write the XML. Defaults to 'cavynext_results.xml'.
export default function constructXML(
  results: FullResults,
  filename = 'cavynext_results.xml',
): void {
  console.log(`Writing results to ${filename}`);

  const builder = new Builder();
  const formattedResults = {
    testsuite: {
      $: {
        name: 'cavynext',
        // cavy-cli read `results.length` here, which is always undefined on an
        // object; the count comes from the test cases themselves.
        tests: results.testCases.length,
        failures: results.testCases.filter((test) => test.errorMessage).length,
        // Errors are currently reported in the same way as failures.
        errors: 0,
        time: results.time,
        timestamp: results.timestamp,
        hostname: os.hostname(),
      },
      testcase: results.testCases.map((test) => formattedTestCase(test)),
    },
  };

  writeFileSync(filename, builder.buildObject(formattedResults));
}
