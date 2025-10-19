import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'worker/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
