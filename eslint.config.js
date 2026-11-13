import js from '@eslint/js';
import globals from 'globals';

// Phase 1: the legacy game entry and the extracted engine modules are still
// minified single-file code. Linting them would produce noise without a useful
// signal, so the gate covers handwritten sources and build configuration only.
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'artifacts/**',
      '.npm-cache/**',
      '.omni-workstation/**',
      'src/game/**',
      'src/engine/*/index.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
