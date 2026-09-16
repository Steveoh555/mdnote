// Character / word / reading-time estimates that work for Korean and English.
export function computeStats(text) {
  const chars = text.replace(/\s/g, '').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hangul = (text.match(/[가-힣]/g) || []).length;
  // ~200 wpm for space-delimited words, ~500 syllables/min for Korean.
  const minutes = Math.max(1, Math.ceil(Math.max(words / 200, hangul / 500)));
  return { chars, words, minutes };
}
