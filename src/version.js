import { readFileSync } from 'fs';
import { dirname, join } from 'path';

function resolveAppVersion() {
  // Bundled single-executable build: injected by build.js (--define).
  if (typeof __APP_VERSION__ === 'string') return __APP_VERSION__;
  // Source mode: read relative to the entry script. (import.meta.url is
  // unavailable in the bundled CJS format, so don't rely on it here.)
  try {
    const root = dirname(dirname(process.argv[1]));
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || '';
  } catch {
    return '';
  }
}

export const APP_VERSION = resolveAppVersion();
