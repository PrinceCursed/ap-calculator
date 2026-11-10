/// <reference types="vitest/config" />
import { existsSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// base = путь, по которому сайт открывается на GitHub Pages: https://<user>.github.io/<repo>/
// Для своего домена (CNAME) соберите с VITE_BASE=/ (см. README).
const base = process.env.VITE_BASE ?? '/ap-calculator/';

/** Если в public/ лежит logo.svg / logo.png — он же становится favicon. Нет файла — остаётся favicon.svg. */
function logoFavicon(): Plugin {
  const found = ['logo.svg', 'logo.png'].find((f) => existsSync(new URL(`./public/${f}`, import.meta.url)));
  return {
    name: 'logo-favicon',
    transformIndexHtml: (html) =>
      found ? html.replace('href="./favicon.svg"', `href="./${found}"`).replace('type="image/svg+xml"', found.endsWith('.png') ? 'type="image/png"' : 'type="image/svg+xml"') : html,
  };
}

export default defineConfig({
  base,
  plugins: [react(), logoFavicon()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
  },
});
