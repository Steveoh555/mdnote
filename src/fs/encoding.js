// Safe text decoding for files of unknown origin.
// UTF-8 is tried strictly first; a byte sequence that is not valid UTF-8 is
// retried as EUC-KR (legacy Korean) and UTF-16 with BOM. If nothing decodes
// cleanly the text is returned lossily and flagged, so the app can refuse to
// overwrite the original with replacement characters.

const BOM_UTF8 = [0xef, 0xbb, 0xbf];

export function decodeBytes(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bytes = u8;
  let bom = false;
  if (u8.length >= 3 && u8[0] === BOM_UTF8[0] && u8[1] === BOM_UTF8[1] && u8[2] === BOM_UTF8[2]) {
    bom = true;
    bytes = u8.subarray(3);
  }
  const strict = (label, b) => {
    try { return new TextDecoder(label, { fatal: true }).decode(b); } catch { return null; }
  };

  let text = strict('utf-8', bytes);
  if (text !== null) return { text, encoding: 'utf-8', bom };

  if (u8.length >= 2 && ((u8[0] === 0xff && u8[1] === 0xfe) || (u8[0] === 0xfe && u8[1] === 0xff))) {
    text = strict(u8[0] === 0xff ? 'utf-16le' : 'utf-16be', u8.subarray(2));
    if (text !== null) return { text, encoding: 'utf-16', bom: true };
  }

  text = strict('euc-kr', bytes);
  if (text !== null) return { text, encoding: 'euc-kr', bom: false };

  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'unknown', bom };
}

export function encodeText(text, bom = false) {
  const body = new TextEncoder().encode(text);
  if (!bom) return body;
  const out = new Uint8Array(body.length + 3);
  out.set(BOM_UTF8, 0);
  out.set(body, 3);
  return out;
}
