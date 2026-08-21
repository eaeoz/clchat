#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import os from 'os';
import { join as pathJoin } from 'path';
import { mkdirSync, appendFileSync } from 'fs';

import blessed from 'blessed';
import api from './api/client.js';
import socket from './socket/client.js';
import { setTheme, getTheme, getCurrentTheme } from './themes/index.js';
import { loadConfig, loadSession, saveSession, clearSession } from './utils/storage.js';
import createLoginScreen from './screens/login.js';
import createLobbyScreen from './screens/lobby.js';
import createChatScreen from './screens/chat.js';

// Load config
const config = loadConfig();
if (config.theme) setTheme(config.theme);

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Social CLI',
  fullUnicode: true,
  mouse: true, // required for list clicks / wheel scrolling to work at all
});

// Hide the terminal cursor everywhere (text inputs included).
// NOTE: blessed's terminfo emits EMPTY strings for civis/cnorm on some
// Windows setups, so program.hideCursor() silently does nothing there.
// Force the standard ANSI DECTCEM sequences instead, neutralize blessed's
// attempts to re-show the cursor when a textbox grabs focus, and restore
// the real cursor on exit no matter how we quit.
const program = screen.program;
program.hideCursor = function () {
  this.cursorHidden = true;
  this._write('\x1b[?25l');
};
program.showCursor = function () {};
program.hideCursor();
process.on('exit', () => {
  try {
    program._write('\x1b[?25h');
    program.flush();
  } catch {}
});

let currentView = null;
let currentUser = null;

function clearCurrentView() {
  if (currentView) {
    currentView.destroy();
    currentView = null;
  }
}

function showLogin() {
  clearCurrentView();
  currentView = createLoginScreen(screen, (user, accessToken, refreshToken) => {
    currentUser = user;
    api.setTokens(accessToken, refreshToken);
    api.setUser(user);

    // Connect socket (auth is sent automatically on connect/reconnect)
    socket.connect();
    socket.authenticate(user.userId, user.username);

    showLobby();
  });
}

function showLobby(focusPanel = 'rooms') {
  clearCurrentView();
  currentView = createLobbyScreen(
    screen,
    currentUser,
    (room) => showChat(room, null),
    (privateChat) => showChat(null, privateChat),
    () => handleLogout(),
    () => showLobby(),
    focusPanel
  );
}

function showChat(room, privateChat) {
  clearCurrentView();
  currentView = createChatScreen(
    screen,
    currentUser,
    room || {},
    privateChat,
    () => showLobby(privateChat ? 'dms' : 'rooms')
  );
}

async function handleLogout() {
  try {
    socket.sendLogout('user_logout');
    await api.logout();
  } catch {}
  socket.disconnect();
  clearSession();
  currentUser = null;
  showLogin();
}

// Handle forced logout from server
socket.on('force_logout', (data) => {
  clearSession();
  currentUser = null;
  socket.disconnect();
  showLogin();
});

// Global error handler
// Never console.error inside the TUI — it paints raw text over panels and
// leaves blessed in an inconsistent state. Log to disk instead and try to
// keep the interface usable.
function logCrash(kind, error) {
  try {
    const dir = pathJoin(os.homedir(), '.social-cli');
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, 'error.log'),
      `[${new Date().toISOString()}] ${kind}: ${error && error.stack ? error.stack : String(error)}\n`
    );
  } catch { /* logging must never throw */ }
}

process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error);
  try {
    screen.render();
  } catch {
    // The crash may have corrupted the widget tree itself; if we cannot
    // recover the display, exit cleanly rather than limp along.
    try { screen.destroy(); } catch {}
    process.exit(1);
  }
});

process.on('unhandledRejection', (error) => {
  logCrash('unhandledRejection', error);
});

// Cleanup on exit
screen.on('destroy', () => {
  socket.disconnect();
  process.exit(0);
});

// Key bindings
screen.key(['C-c'], () => {
  socket.disconnect();
  process.exit(0);
});

screen.key(['f10'], () => {
  socket.disconnect();
  process.exit(0);
});

// Try to restore session
async function init() {
  const session = loadSession();

  if (session && session.accessToken && session.user) {
    currentUser = session.user;
    api.setTokens(session.accessToken, session.refreshToken);
    api.setUser(session.user);

    // Verify token is still valid
    try {
      await api.getMe();
      currentUser = api.user || session.user;

      // Connect socket (auth is sent automatically on connect/reconnect)
      socket.connect();
      socket.authenticate(currentUser.userId, currentUser.username);

      showLobby();
      return;
    } catch {
      clearSession();
    }
  }

  showLogin();
}

init();
