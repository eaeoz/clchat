import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.social-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const SESSION_FILE = join(CONFIG_DIR, 'session.json');

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return { theme: 'default' };
}

export function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
      if (session.expiresAt && Date.now() < session.expiresAt) {
        return session;
      }
    }
  } catch {}
  return null;
}

export function saveSession(accessToken, refreshToken, user) {
  ensureConfigDir();
  const session = {
    accessToken,
    refreshToken,
    user,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

export function clearSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      unlinkSync(SESSION_FILE);
    }
  } catch {}
}

export function getConfigPath() {
  return CONFIG_DIR;
}
