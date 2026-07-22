// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // React Native renders text directly; HTML entity escaping is unnecessary.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
