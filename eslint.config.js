import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Enforces the functional style from docs/adr/0004-functional-typescript-style.md.
// The "one exported function per file" rule is convention (see CLAUDE.md), not lint-enforced.
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'src-tauri/target/**', 'src-tauri/gen/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    rules: {
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: 'Classes are not used in this codebase.' },
        { selector: 'ClassExpression', message: 'Classes are not used in this codebase.' },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
