import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Public: The platforms the CLI can drive.
export type Platform = 'android' | 'ios' | 'web' | 'kepler';

// Public: Capture a screenshot of the running app.
//
// Screenshots are opt-in (see the `--screenshots` flag) because cavy-cli
// captured one after every single test, which is slow and fills the disk.
//
// platform - which platform the app is running on. Only 'android' and 'ios'
//            can be captured; anything else is skipped.
// label    - optional label mixed into the filename, e.g. the test number.
export default function takeScreenshot(platform: Platform | undefined, label?: string): void {
  if (platform !== 'android' && platform !== 'ios') {
    return;
  }

  const suffix = label ? `_${label.replace(/[^a-z0-9]+/gi, '-')}` : '';
  const filename = `screenshot_${Date.now()}${suffix}.png`;
  const folder = process.env.CAVYNEXT_SCREENSHOT_DIR || 'screenshots';
  fs.mkdirSync(folder, { recursive: true });
  const fullPath = path.join(folder, filename);

  const command =
    platform === 'android'
      ? `adb exec-out screencap -p > ${fullPath}`
      : `xcrun simctl io booted screenshot ${fullPath}`;

  exec(command, (error) => {
    if (error) {
      console.error(`Error taking screenshot: ${error.message}`);
      return;
    }
    console.log(`Screenshot saved as ${fullPath}`);
  });
}
