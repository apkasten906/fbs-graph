import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts', 'web/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.vscode', '.github'],
    reporters: ['verbose'],
    outputFile: {
      json: './test-results.json',
    },
    silent: false,
    hideSkippedTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', 'scripts/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './types'),
    },
  },
});
