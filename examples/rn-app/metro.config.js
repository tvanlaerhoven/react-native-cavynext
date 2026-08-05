const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const monorepoRoot = path.resolve(__dirname, '../..');

/**
 * Metro config that resolves react-native-cavynext from the sibling package in
 * this monorepo. A standalone app installing from npm needs none of this.
 */
const config = {
  // Metro must be told about files outside the app folder.
  watchFolders: [path.resolve(monorepoRoot, 'packages')],
  resolver: {
    // Always use this app's copy of React and React Native, so the linked
    // package can't pull in a second one.
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
