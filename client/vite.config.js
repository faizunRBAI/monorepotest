import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  // Env files live at the repo root next to the server's config, not in client/.
  // Only VITE_-prefixed keys are exposed to the bundle, so the DB and SMTP secrets in
  // that file are still never shipped to the browser.
  envDir: resolve(__dirname, '..'),
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000'
    }
  }
});
