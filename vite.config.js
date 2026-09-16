import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: "/" is the landing site, "/app/" is the editor itself.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
