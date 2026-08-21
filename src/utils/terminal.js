export function getTerminalSize() {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

export function isSmallTerminal() {
  const { width, height } = getTerminalSize();
  return width < 80 || height < 24;
}

export function isTinyTerminal() {
  const { width, height } = getTerminalSize();
  return width < 60 || height < 18;
}

export function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '\u2026';
}

export function padRight(str, len) {
  if (!str) return ' '.repeat(len);
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

export function padLeft(str, len) {
  if (!str) return ' '.repeat(len);
  if (str.length >= len) return str.substring(0, len);
  return ' '.repeat(len - str.length) + str;
}

export function center(str, len) {
  if (!str) return ' '.repeat(len);
  if (str.length >= len) return str.substring(0, len);
  const leftPad = Math.floor((len - str.length) / 2);
  const rightPad = len - str.length - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function formatRelativeTime(ts) {
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contrast helpers — some themes define dimFg/muted with the SAME value as
//  headerBg/statusBarBg (solarized, dracula), making text on those surfaces
//  invisible. Pick the candidate with the largest luminance distance from bg.
// ─────────────────────────────────────────────────────────────────────────────
function luminance(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return null;
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/** Choose the most readable color from `candidates` to place on `bgHex`. */
export function pickReadable(bgHex, candidates) {
  const bgL = luminance(bgHex);
  if (bgL == null) return candidates.find(c => c) || '';
  let best = candidates.find(c => c) || '';
  let bestDist = -1;
  for (const c of candidates) {
    const l = luminance(c);
    if (l == null) continue;
    const dist = Math.abs(l - bgL);
    if (dist > bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

/**
 * Prefer a dim foreground, but never an invisible one: return the first
 * candidate whose luminance distance from bgHex exceeds minContrast,
 * falling back to the highest-contrast candidate.
 */
export function readableDim(bgHex, candidates, minContrast = 40) {
  const bgL = luminance(bgHex);
  if (bgL == null) return pickReadable(bgHex, candidates);
  for (const c of candidates) {
    const l = luminance(c);
    if (l != null && Math.abs(l - bgL) >= minContrast) return c;
  }
  return pickReadable(bgHex, candidates);
}
