import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@filament-workbench/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@filament-workbench/schemas': path.resolve(__dirname, 'packages/schemas/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
