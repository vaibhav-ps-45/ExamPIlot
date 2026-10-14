import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Tests that touch the database are excluded from the default run unless
    // DATABASE_URL is present; see README for how to run integration tests.
    globals: false,
  },
});
