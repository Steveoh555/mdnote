import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: "/" is the landing site, "/app/" is the editor itself.

// The web build carries its CSP in a <meta> tag as well as the header in public/_headers
// (Cloudflare Pages), so the policy still applies wherever the files are served from.
// The desktop build gets its CSP from tauri.conf.json (Tauri adds nonces for its own
// injected scripts), so the tag is skipped when the Tauri CLI drives the build.
const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com ws://localhost:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ');

const metaCsp = () => ({
  name: 'mdnote-meta-csp',
  transformIndexHtml(html) {
    if (process.env.TAURI_ENV_PLATFORM) return html;
    return html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n  <meta http-equiv="Content-Security-Policy" content="${WEB_CSP}" />`);
  },
});

export default defineConfig({
  plugins: [metaCsp()],
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
