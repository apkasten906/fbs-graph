// .eslintrc.cjs (root)
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    '@next/next',
    'react-hooks',
    // 'prettier' removed from plugins
  ],
  extends: ['eslint:recommended', 'plugin:@next/next/recommended', 'plugin:prettier/recommended'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn'],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-undef': 'off', // Disable for browser globals like window, document
  },
  overrides: [
    // Node and tool config files (relax TypeScript rules and disable custom rules for plain JS config files)
    {
      files: [
        'next.config.js',
        '*.config.js',
        '*.config.cjs',
        '*.config.mjs',
        'tailwind.config.js',
        'tailwind.config.cjs',
      ],
      env: { node: true },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    // Backend API (Node)
    {
      files: ['packages/api/**/*.{js,ts}'],
      env: { node: true, browser: false },
      rules: {
        '@next/next/no-html-link-for-pages': 'off',
        '@next/next/no-img-element': 'off',
      },
    },
    // JavaScript files - disable TypeScript-specific rules but keep JSX support
    {
      files: ['**/*.js', '**/*.jsx'],
      parser: '@typescript-eslint/parser', // Keep TS parser for JSX support
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      env: { browser: true, node: true },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-unused-vars': 'warn',
      },
    },
    // Core library (Node) - TypeScript files
    {
      files: ['packages/core/**/*.ts', 'apps/web/**/*.ts', 'packages/api/**/*.ts'],
      extends: ['plugin:@typescript-eslint/recommended'],
      env: { node: true, browser: false },
    },
    // Exclude .ts and .js files in the Docs folder from linting, allow markdown files
    {
      files: ['docs/**/*.ts', 'docs/**/*.js'],
      rules: {
        all: 'off', // Disable all rules for .ts and .js files in the Docs folder
      },
    },
  ],
  settings: {
    'import/resolver': {
      node: {
        paths: ['.'],
      },
    },
  },
  env: {
    node: true,
  },
};

// Note: 'plugin:@next/next/recommended' includes rules from 'eslint-config-next'
// which is the official ESLint configuration for Next.js projects.
// This setup ensures that ESLint is properly configured for a Next.js project
// while also integrating Prettier for code formatting.
