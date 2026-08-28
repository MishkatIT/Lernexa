import { defineConfig } from 'vitest/config';

// Unit tests only — pure functions (grading, progress) and the permission
// matrix. No Strapi boot. See docs/ARCHITECTURE.md "Testing strategy".
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
