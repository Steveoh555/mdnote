import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: "/" is the landing site, "/app/" is the editor itself.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        guide: resolve(__dirname, 'guide/index.html'),
        guide1: resolve(__dirname, 'guide/md-file-open.html'),
        guide2: resolve(__dirname, 'guide/chatgpt-md.html'),
        guide3: resolve(__dirname, 'guide/markdown-basics.html'),
        guide4: resolve(__dirname, 'guide/notion-export.html'),
        guide5: resolve(__dirname, 'guide/md-to-pdf.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
