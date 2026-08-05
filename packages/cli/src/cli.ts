import { Command, Option } from 'commander';

import init from './init';
import runTests, { type RunCommand, type RunTestsOptions } from './runTests';

// Internal: Options parsed from a run command, before being handed to runTests.
interface CommandOptions {
  file?: string;
  skipbuild?: boolean;
  buildCmd?: string;
  dev?: boolean;
  xml?: boolean;
  markdown?: boolean;
  screenshots?: boolean;
  bootTimeout?: number;
}

// Internal: Extract the arguments that should be forwarded to the React Native
// CLI: everything after the command name, minus our own options.
//
// Our flags have to be stripped so the RN CLI does not choke on them, but only
// the first occurrence of each is removed, because the second might be a
// legitimate RN CLI option of the same name.
function forwardedArgs(command: Command): string[] {
  const allArgs = process.argv;
  const commandIndex = allArgs.indexOf(command.name());
  const args = allArgs.slice(commandIndex + 1);

  for (const option of command.options) {
    for (let i = 0; i < args.length; i++) {
      if ([option.short, option.long].includes(args[i])) {
        // Remove the flag and, if it takes one, its value.
        args.splice(i, option.required || option.optional ? 2 : 1);
        break;
      }
    }
  }

  // Escape spaces, since the RN CLI is spawned through a shell.
  return args.map((arg) => arg.replace(/ /g, '\\ '));
}

// Internal: Turn a parsed command into RunTestsOptions and start the run.
function test(commandName: RunCommand, options: CommandOptions, command: Command): void {
  const runOptions: RunTestsOptions = {
    command: commandName,
    file: options.file,
    skipbuild: options.skipbuild,
    buildCmd: options.buildCmd,
    dev: options.dev,
    xml: options.xml,
    markdown: options.markdown,
    screenshots: options.screenshots,
    bootTimeout: options.bootTimeout,
    args: forwardedArgs(command),
  };

  runTests(runOptions);
}

// Internal: Options shared by every run command.
function addCommonOptions(command: Command): Command {
  return command
    .option('-f, --file <file>', 'App entry file (defaults to index.js)')
    .option('-d, --dev', 'Keep the report server alive until manually killed')
    .addOption(
      new Option(
        '-t, --boot-timeout <minutes>',
        'How long to wait for the app to boot (ignored with --skipbuild, defaults to 2 minutes)',
      ).argParser(parseFloat),
    )
    .option('-b, --buildCmd <cmd>', 'Custom command used to build and run the app')
    .option('--xml', 'Write test results to cavynext_results.xml')
    .option('--markdown', 'Write a markdown summary to cavynext_results.md')
    .option('--screenshots', 'Capture a screenshot after every test result')
    .allowUnknownOption();
}

const program = new Command();

program
  .name('cavynext')
  .description('Run react-native-cavynext integration tests from the command line.')
  .version('0.1.0');

program
  .command('init [specFolderName]')
  .description('Add cavynext to a project, with an optional spec folder name')
  .action((specFolderName?: string) => {
    init(specFolderName);
  });

addCommonOptions(
  program
    .command('run-ios')
    .description('Run specs on an iOS simulator or device')
    .option('-s, --skipbuild', 'Start the report server without first building the app'),
).action((options: CommandOptions, command: Command) => test('run-ios', options, command));

addCommonOptions(
  program
    .command('run-android')
    .description('Run specs on an Android emulator or device')
    .option('-s, --skipbuild', 'Start the report server without first building the app'),
).action((options: CommandOptions, command: Command) => test('run-android', options, command));

addCommonOptions(program.command('run-web').description('Run specs on the web platform')).action(
  (options: CommandOptions, command: Command) => test('run-web', options, command),
);

addCommonOptions(program.command('run-vega').description('Run specs on the Vega platform')).action(
  (options: CommandOptions, command: Command) => test('run-vega', options, command),
);

// Keep the process alive while we wait for results.
process.stdin.resume();

program.parse(process.argv);
