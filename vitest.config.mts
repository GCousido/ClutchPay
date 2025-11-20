import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false, // Run test files sequentially to avoid database conflicts
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      all: true,
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        'coverage/',
        'scripts/',
        'front/',
        '**/migrations/**',
        // Next.js interface for testing files to ignore
        'prisma/seed.ts',
        'src/app/(auth)/',
        'src/app/dashboard/',
        'src/app/favicon.ico',
        'src/app/globals.css',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/components/',
        'src/i18n/',
        'src/proxy.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
