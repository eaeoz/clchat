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
