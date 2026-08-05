#!/usr/bin/env node
// Development harness: pretends to be an app running react-native-cavynext's
// WebSocketReporter, so the CLI report server can be exercised without a
// simulator.
//
// Usage:
//   node packages/cli/scripts/fakeApp.js [--fail]
//
// Start the report server first, e.g.:
//   node packages/cli/bin/cavynext.js run-web --xml --markdown
const WebSocket = require('ws');

const shouldFail = process.argv.includes('--fail');
const port = Number(process.env.CAVYNEXT_PORT || 8082);

const ws = new WebSocket(`ws://127.0.0.1:${port}/`);

function send(event, data) {
  ws.send(JSON.stringify({ event, data }));
}

ws.on('open', () => {
  send('notify', {});
  send('message', { message: 'LOG fake app booted', level: 'log' });

  const results = [
    { message: 'Logging in: works  ✅', passed: true },
    shouldFail
      ? { message: 'Logging in: fails  ❌\n   Caught error: boom', passed: false }
      : { message: 'Logging in: also works  ✅', passed: true },
  ];
  results.forEach((result) => send('singleResult', result));

  const testCases = [
    {
      describeLabel: 'Logging in',
      description: 'Logging in: works',
      message: results[0].message,
      passed: true,
      time: 0.12,
    },
    {
      describeLabel: 'Logging in',
      description: shouldFail ? 'Logging in: fails' : 'Logging in: also works',
      message: results[1].message,
      ...(shouldFail ? { errorMessage: 'boom' } : {}),
      passed: !shouldFail,
      time: 0.34,
    },
  ];

  send('testingComplete', {
    results: testCases,
    fullResults: { time: 0.46, timestamp: new Date().toISOString(), testCases },
    errorCount: shouldFail ? 1 : 0,
    duration: 0.46,
  });

  // Give the socket a moment to flush before exiting.
  setTimeout(() => ws.close(), 250);
});

ws.on('error', (error) => {
  console.error(`fakeApp: could not reach the report server: ${error.message}`);
  process.exit(1);
});
