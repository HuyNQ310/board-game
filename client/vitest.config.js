import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Only run vitest-style (.test.jsx/.test.tsx) suites here.
    // .test.mjs files are node:test-style suites run separately via `node --test`.
    include: ['src/**/*.test.{jsx,tsx}'],
    setupFiles: ['./src/test-setup.js'],
  },
});
