#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

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
});

screen.program.hideCursor();

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

    // Connect socket
    socket.connect();
    socket.on('connected', () => {
      socket.authenticate(user.userId, user.username);
    });

    showLobby();
  });
}

function showLobby() {
  clearCurrentView();
  currentView = createLobbyScreen(
    screen,
    currentUser,
    (room) => showChat(room, null),
    (privateChat) => showChat(null, privateChat),
    () => handleLogout(),
    () => showLobby()
  );
}

function showChat(room, privateChat) {
  clearCurrentView();
  currentView = createChatScreen(
    screen,
    currentUser,
    room || {},
    privateChat,
    () => showLobby()
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
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
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

      // Connect socket
      socket.connect();
      socket.on('connected', () => {
        socket.authenticate(currentUser.userId, currentUser.username);
      });

      showLobby();
      return;
    } catch {
      clearSession();
    }
  }

  showLogin();
}

init();
