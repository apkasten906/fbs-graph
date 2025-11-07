// Flat ESLint config with FlatCompat to support legacy shareable configs
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'] },

  // Import legacy .eslintrc.cjs config using FlatCompat
  ...compat.extends('./.eslintrc.cjs'),

  // Additional relaxations for JavaScript files to reduce noisy TypeScript warnings
  {
    files: ['**/*.js', '**/*.jsx', 'web/**/*.js', 'web/**/*.jsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Disable Next.js rules since this project doesn't use Next.js pages routing
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
