const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
    rules: {
      // React Compiler is not enabled in app.config.ts. Keep its migration diagnostics
      // visible while preserving Expo checks and the Rules of Hooks as blocking errors.
      // Native Animated refs and existing async-loading effects need separate review.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
