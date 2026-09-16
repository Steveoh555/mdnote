import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight(code, lang) {
    const language = (lang || '').trim().toLowerCase();
    if (language === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
    }
    let body;
    if (language && hljs.getLanguage(language)) {
      body = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } else {
      body = escapeHtml(code);
    }
    const label = language ? `<span class="code__lang">${escapeHtml(language)}</span>` : '';
    return `<pre class="code">${label}<button class="code__copy" type="button" data-copy>copy</button><code class="hljs">${body}</code></pre>`;
  },
});

// --- Task lists: "- [ ] item" / "- [x] item" -------------------------------
md.core.ruler.after('inline', 'task_lists', (state) => {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== 'inline') continue;
    if (tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
    const first = tok.children?.[0];
    if (!first || first.type !== 'text') continue;
    const m = /^\[( |x|X)\]\s+/.exec(first.content);
    if (!m) continue;
    first.content = first.content.slice(m[0].length);
    const checked = m[1] !== ' ';
    const box = new state.Token('html_inline', '', 0);
    box.content = `<input type="checkbox" class="task-box" disabled${checked ? ' checked' : ''}> `;
    tok.children.unshift(box);
    tokens[i - 2].attrJoin('class', 'task-item' + (checked ? ' task-item--done' : ''));
    // Mark the enclosing list so we can drop bullet markers.
    for (let j = i - 3; j >= 0; j--) {
      if (tokens[j].type === 'bullet_list_open' || tokens[j].type === 'ordered_list_open') {
        tokens[j].attrJoin('class', 'task-list');
        break;
      }
    }
  }
});

// --- Heading ids (for the outline panel) ---------------------------------
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 80) || 'section';

md.core.ruler.push('heading_ids', (state) => {
  const seen = new Map();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    const text = inline?.children?.filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('') ?? '';
    let id = slugify(text);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    tokens[i].attrSet('id', 'sec-' + id);
  }
});

// External links open in a new tab.
const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

// Tables scroll horizontally inside a wrapper.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => '</table></div>';

export function renderMarkdown(text) {
  return md.render(text);
}

let mermaidModule = null;
export async function renderMermaid(container, dark) {
  const nodes = container.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  if (!mermaidModule) mermaidModule = (await import('mermaid')).default;
  mermaidModule.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'neutral',
    securityLevel: 'strict',
    fontFamily: 'inherit',
  });
  try {
    await mermaidModule.run({ nodes, suppressErrors: true });
  } catch {
    /* mermaid reports syntax errors inline */
  }
}
