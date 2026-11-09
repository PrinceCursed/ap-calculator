/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = путь, по которому сайт открывается на GitHub Pages: https://<user>.github.io/<repo>/
// Для своего домена (CNAME) соберите с VITE_BASE=/ (см. README).
const base = process.env.VITE_BASE ?? '/ap-calculator/';

export default defineConfig({
  base,
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
  },
});
