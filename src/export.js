import tokensCss from './styles/tokens.css?inline';
import markdownCss from './styles/markdown.css?inline';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Standalone HTML file: same typography as the reader, no external assets.
export function buildHtmlDocument({ title, bodyHtml, dark, lang }) {
  return `<!doctype html>
<html lang="${lang}" data-theme="${dark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${tokensCss}
${markdownCss}
html, body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-ui); }
.md { max-width: 760px; margin: 0 auto; padding: 48px 32px 96px; }
.code__copy { display: none; }
</style>
</head>
<body>
<article class="md">
${bodyHtml}
</article>
</body>
</html>`;
}
