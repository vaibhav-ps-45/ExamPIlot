/// <reference types="vitest" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  cacheDir: path.resolve(__dirname, '../../.vite-cache'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\\\', '/');
          if (moduleId.includes('/node_modules/react/') || moduleId.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (moduleId.includes('/node_modules/react-router/')) return 'router-vendor';
          if (moduleId.includes('/node_modules/@radix-ui/')) return 'radix-vendor';
          if (moduleId.includes('/node_modules/@tanstack/')) return 'query-vendor';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
