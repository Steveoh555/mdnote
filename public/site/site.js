// Fills the download buttons from the latest GitHub release, if one exists.
// Falls back to the "coming soon" note when no release is published yet.
const REPO = 'withyou-books/mdnote';

const win = document.getElementById('dl-win');
const mac = document.getElementById('dl-mac');
const note = document.getElementById('dl-note');

async function fillDownloads() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('no release');
    const rel = await res.json();
    const assets = rel.assets || [];
    const safe = (a) => a && /^https:\/\/github\.com\//.test(a.browser_download_url);
    const pick = (re) => assets.find((a) => re.test(a.name) && safe(a));
    const winAsset = pick(/-setup\.exe$/i) || pick(/\.exe$/i) || pick(/\.msi$/i);
    const macAsset = pick(/aarch64.*\.dmg$/i) || pick(/\.dmg$/i);
    let any = false;
    if (winAsset) { win.href = winAsset.browser_download_url; any = true; } else { win.setAttribute('aria-disabled', 'true'); }
    if (macAsset) { mac.href = macAsset.browser_download_url; any = true; } else { mac.setAttribute('aria-disabled', 'true'); }
    note.textContent = any ? `최신 버전 ${rel.tag_name} · 무료 · 광고 없음` : note.textContent;
  } catch {
    win.setAttribute('aria-disabled', 'true');
    mac.setAttribute('aria-disabled', 'true');
  }
}

fillDownloads();
