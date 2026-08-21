import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme, getThemeNames, setTheme } from '../themes/index.js';
import { loadConfig, saveConfig } from '../utils/storage.js';
import { truncate } from '../utils/terminal.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a "panel header" line with a right-aligned badge */
function panelTitle(icon, label, count = null) {
  const badge = count != null && count > 0 ? ` (${count})` : '';
  return ` ${icon} ${label.toUpperCase()}${badge}`;
}

/** Format an unread badge string */
function unreadBadge(n) {
  if (!n || n <= 0) return '';
  return n > 99 ? ' {bold}(99+){/bold}' : ` {bold}(${n}){/bold}`;
}

/** Total unread across DMs, counted once per user — the server can list
 *  the same conversation twice (duplicate chat docs), which would make a
 *  plain sum double-count the total shown in the panel header. */
function dmTotalUnread(list) {
  const seen = new Set();
  let total = 0;
  for (const chat of list || []) {
    const id = chat.otherUser && chat.otherUser.userId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    total += chat.unreadCount || 0;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
export default function createLobbyScreen(screen, user, onJoinRoom, onOpenChat, onLogout, onThemeChange) {
  const theme = getCurrentTheme();
  const config = loadConfig();

  // ── Root container ────────────────────────────────────────────
  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  // ══════════════════════════════════════════════════════════════
  //  HEADER (3 rows tall)
  // ══════════════════════════════════════════════════════════════
  const header = blessed.box({
    parent: container,
    top: 0,
    width: '100%',
    height: 3,
    style: { bg: theme.headerBg },
  });

  // App name + logo
  blessed.text({
    parent: header,
    top: 1,
    left: 2,
    height: 1,
    content: `{bold}✦ Social CLI{/bold}`,
    tags: true,
    style: { fg: theme.accent, bg: theme.headerBg },
  });

  // User info
  const headerUser = blessed.text({
    parent: header,
    top: 1,
    right: 2,
    height: 1,
    content: `👤 {bold}${user.username}{/bold}  {green-fg}●{/green-fg} online`,
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
    align: 'right',
  });

  // ── STATUS BAR (row 3) ────────────────────────────────────────
  const statusBar = blessed.box({
    parent: container,
    top: 3,
    width: '100%',
    height: 1,
    style: { bg: theme.statusBarBg },
  });

  const statusText = blessed.text({
    parent: statusBar,
    left: 1,
    width: '70%',
    height: '100%',
    content: ` {green-fg}●{/green-fg} Connected`,
    tags: true,
    style: { fg: theme.fg, bg: theme.statusBarBg },
  });

  const statusRight = blessed.text({
    parent: statusBar,
    right: 1,
    width: '30%',
    height: '100%',
    content: `{right}F1 Help  F5 Refresh{/right}`,
    tags: true,
    style: { fg: theme.dimFg || theme.muted, bg: theme.statusBarBg },
    align: 'right',
  });

  // ══════════════════════════════════════════════════════════════
  //  MAIN AREA  (rows 4 … bottom-4)
  // ══════════════════════════════════════════════════════════════
  const mainArea = blessed.box({
    parent: container,
    top: 4,
    width: '100%',
    bottom: 4,   // leave room for command input (3) + hints bar (1)
  });

  // ── LEFT PANEL — Rooms ────────────────────────────────────────
  const leftPanel = blessed.box({
    parent: mainArea,
    left: 0,
    width: '33%',
    height: '100%',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const roomsHeader = blessed.text({
    parent: leftPanel,
    top: 0,
    left: 0,
    width: '100%-2',
    height: 1,
    content: panelTitle('📡', 'Rooms'),
    tags: true,
    style: { fg: theme.primary, bg: theme.bg, bold: true },
  });

  const roomsList = blessed.list({
    parent: leftPanel,
    top: 1,
    left: 0,
    width: '100%',
    bottom: 0,
    tags: true,
    style: {
      selected: { fg: theme.bg, bg: theme.fg, bold: true },
      item: { fg: theme.fg },
    },
    keys: true,
    mouse: true,
    scrollbar: { style: { bg: theme.border }, track: { bg: theme.sidebarBg || theme.inputBg } },
  });

  // ── MIDDLE PANEL — DMs / Private Chats ────────────────────────
  const middlePanel = blessed.box({
    parent: mainArea,
    left: '33%',
    width: '34%',
    height: '100%',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const dmHeader = blessed.text({
    parent: middlePanel,
    top: 0,
    left: 0,
    width: '100%-2',
    height: 1,
    content: panelTitle('💬', 'Direct Messages'),
    tags: true,
    style: { fg: theme.primary, bg: theme.bg, bold: true },
  });

  const dmList = blessed.list({
    parent: middlePanel,
    top: 1,
    left: 0,
    width: '100%',
    bottom: 0,
    tags: true,
    style: {
      selected: { fg: theme.bg, bg: theme.fg, bold: true },
      item: { fg: theme.fg },
    },
    keys: true,
    mouse: true,
    scrollbar: { style: { bg: theme.border }, track: { bg: theme.sidebarBg || theme.inputBg } },
  });

  // ── RIGHT PANEL — Live Users + search ─────────────────────────
  const rightPanel = blessed.box({
    parent: mainArea,
    right: 0,
    width: '33%',
    height: '100%',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const usersHeader = blessed.text({
    parent: rightPanel,
    top: 0,
    left: 0,
    width: '100%-2',
    height: 1,
    content: panelTitle('👥', 'Users'),
    tags: true,
    style: { fg: theme.primary, bg: theme.bg, bold: true },
  });

  // Search
  const searchInput = blessed.textbox({
    parent: rightPanel,
    top: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.inputFocusBorder || theme.primary } },
    },
    inputOnFocus: true,
    placeholder: '  🔍 Search users…',
  });

  const usersList = blessed.list({
    parent: rightPanel,
    top: 4,
    left: 0,
    width: '100%',
    bottom: 0,
    tags: true,
    style: {
      selected: { fg: theme.bg, bg: theme.fg, bold: true },
      item: { fg: theme.fg },
    },
    keys: true,
    mouse: true,
    scrollbar: { style: { bg: theme.border }, track: { bg: theme.sidebarBg || theme.inputBg } },
  });

  // ══════════════════════════════════════════════════════════════
  //  COMMAND INPUT (bottom, 3 rows tall)
  // ══════════════════════════════════════════════════════════════
  const commandInput = blessed.textbox({
    parent: container,
    bottom: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.inputFocusBorder || theme.primary } },
    },
    inputOnFocus: true,
    placeholder: '  / type a command or press Esc to focus the list…',
  });

  // ── HINTS BAR (bottom row) ────────────────────────────────────
  const hintsBar = blessed.text({
    parent: container,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: '{center}Tab panels  ·  Enter select  ·  ` search  ·  Esc command  ·  F1 help  ·  F5 refresh{/center}',    tags: true,
    style: { fg: theme.dimFg || theme.muted, bg: theme.statusBarBg },
  });

  // ══════════════════════════════════════════════════════════════
  //  STATE
  // ══════════════════════════════════════════════════════════════
  let rooms = [];
  let privateChats = [];       // DM inbox (as returned by the server)
  let displayedChats = [];     // subset actually rendered (only unread)
  let onlineUsers = [];        // users shown in the Users panel (filtered)
  let allUsers = [];
  let displayedUsers = [];     // sorted order actually rendered in usersList
  let genderCache = new Map(); // userId -> 'male' | 'female' | ''
  let userSearchTimeout = null;
  let focusedPanel = 'rooms';  // 'rooms' | 'dms' | 'users' | 'search'

  // ══════════════════════════════════════════════════════════════
  //  FOCUS INDICATOR — highlighted panel header (Tab to switch)
  // ══════════════════════════════════════════════════════════════
  function stylePanelHeader(el, isActive) {
    el.style.fg = isActive ? (theme.panelHeaderActiveFg || theme.bg) : theme.primary;
    el.style.bg = isActive
      ? (theme.panelHeaderActive || theme.activeTab || theme.primary)
      : theme.bg;
  }

  function updateFocusIndicators() {
    stylePanelHeader(roomsHeader, focusedPanel === 'rooms');
    stylePanelHeader(dmHeader, focusedPanel === 'dms');
    stylePanelHeader(usersHeader, focusedPanel === 'users' || focusedPanel === 'search');
    screen.render();
  }

  // ══════════════════════════════════════════════════════════════
  //  DATA LOADING
  // ══════════════════════════════════════════════════════════════
  async function loadData() {
    try {
      statusText.setContent(` {yellow-fg}●{/yellow-fg} Loading…`);
      screen.render();

      const [roomsData, usersData, dmsData] = await Promise.all([
        api.getPublicRooms(),
        api.getUsers(),
        api.getPrivateChats ? api.getPrivateChats() : Promise.resolve({ chats: [] }),
      ]);

      rooms = roomsData.rooms || [];
      allUsers = usersData.users || [];
      onlineUsers = allUsers;
      // Server returns { privateChats: [...] } (same as the web client)
      privateChats = dmsData.privateChats || dmsData.chats || [];

      renderRooms();
      renderDMs();
      renderUsers();
      hydrateGenders();

      const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount || 0), 0)
        + privateChats.reduce((s, c) => s + (c.unreadCount || 0), 0);

      statusText.setContent(
        ` {green-fg}●{/green-fg} Connected` +
        (totalUnread > 0 ? `  {bold}{yellow-fg}[${totalUnread} unread]{/yellow-fg}{/bold}` : '')
      );
      screen.render();
    } catch (error) {
      statusText.setContent(` {red-fg}●{/red-fg} Error loading data`);
      screen.render();
    }
  }

  // ── Rooms list ────────────────────────────────────────────────
  function renderRooms() {
    const items = rooms.map(r => {
      const unread = unreadBadge(r.unreadCount);
      const name = truncate(r.name || 'Unnamed', 22);
      return ` 📡 ${name}${unread}`;
    });
    const header = panelTitle('📡', 'Rooms', rooms.reduce((s, r) => s + (r.unreadCount || 0), 0) || null);
    roomsHeader.setContent(header);
    roomsList.setItems(
      items.length > 0 ? items : [' {gray-fg}No rooms available{/gray-fg}']
    );
    screen.render();
  }

  // ── DMs panel — DM inbox ──────────────────────────────────────
  // Refetch just the inbox (mirrors the web client's loadPrivateChats).
  // The server auto-adds brand-new senders to the chat list, so a
  // refetch is enough for a first message to show up.
  async function refreshDMs() {
    try {
      const dmsData = api.getPrivateChats ? await api.getPrivateChats() : {};
      privateChats = dmsData.privateChats || dmsData.chats || [];
      renderDMs();
    } catch {}
  }

  function renderDMs() {
    const header = panelTitle('💬', 'Direct Messages', dmTotalUnread(privateChats) || null);
    dmHeader.setContent(header);

    // Only show conversations that have unread messages — read ones
    // disappear until a new message arrives
    displayedChats = privateChats.filter(c => (c.unreadCount || 0) > 0);

    const items = displayedChats.map(chat => {
      const other = chat.otherUser || {};
      const name = truncate(other.nickName || other.displayName || other.username || '?', 18);
      const status = other.status === 'online'
        ? `{green-fg}●{/green-fg}`
        : `{gray-fg}○{/gray-fg}`;
      const unread = unreadBadge(chat.unreadCount);
      return ` ${status} ${name}${unread}`;
    });
    dmList.setItems(
      items.length > 0 ? items : [' {gray-fg}No new messages{/gray-fg}']
    );
    screen.render();
  }

  // ── Users panel — live user list ──────────────────────────────
  function sortOnlineFirst(users) {
    return [...users].sort((a, b) => {
      const aOn = a.status === 'online' ? 0 : 1;
      const bOn = b.status === 'online' ? 0 : 1;
      return aOn - bOn;
    });
  }

  function renderUsers() {
    const onlineCount = allUsers.filter(u => u.status === 'online').length;
    usersHeader.setContent(panelTitle('👥', 'Users', onlineCount));

    displayedUsers = sortOnlineFirst(onlineUsers);

    const items = displayedUsers.map(u => {
      const name = truncate(u.nickName || u.displayName || u.username, 18);
      const gender = (u.gender || genderCache.get(u.userId) || '').toLowerCase();
      const gIcon = gender === 'male' ? '{blue-fg}♂{/blue-fg}' : gender === 'female' ? '{magenta-fg}♀{/magenta-fg}' : '{gray-fg}·{/gray-fg}';
      const nameColored = gender === 'male'
        ? `{blue-fg}${name}{/blue-fg}`
        : gender === 'female'
          ? `{magenta-fg}${name}{/magenta-fg}`
          : name;
      const status = u.status === 'online'
        ? `{green-fg}●{/green-fg}`
        : `{gray-fg}○{/gray-fg}`;
      const age = u.age ? ` {gray-fg}(${u.age}){/gray-fg}` : '';
      return ` ${status} ${gIcon} ${nameColored}${age}`.replace(/\s+$/, '');
    });
    usersList.setItems(
      items.length > 0 ? items : [' {gray-fg}No users found{/gray-fg}']
    );
    screen.render();
  }

  // Fetch full profiles in background to learn each user's gender
  // (the /users list endpoint does not include it), then re-render.
  async function hydrateGenders() {
    const unknown = displayedUsers.filter(u => !genderCache.has(u.userId));
    if (unknown.length === 0) return;

    let index = 0;
    let updated = false;
    async function worker() {
      while (index < unknown.length) {
        const u = unknown[index++];
        try {
          const res = await api.getUserProfile(u.userId);
          const prof = (res && res.user) || res || {};
          genderCache.set(u.userId, (prof.gender || '').toLowerCase());
          updated = true;
        } catch {
          genderCache.set(u.userId, '');
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(5, unknown.length) }, worker)
    );
    if (updated) renderUsers();
  }

  // ══════════════════════════════════════════════════════════════
  //  SELECTION HANDLERS
  // ══════════════════════════════════════════════════════════════
  roomsList.on('select', (item, index) => {
    if (rooms[index]) onJoinRoom(rooms[index]);
  });

  dmList.on('select', (item, index) => {
    const chat = displayedChats[index];
    if (chat && chat.otherUser) onOpenChat(chat.otherUser);
  });

  usersList.on('select', (item, index) => {
    if (displayedUsers[index]) onOpenChat(displayedUsers[index]);
  });

  // ══════════════════════════════════════════════════════════════
  //  SEARCH
  // ══════════════════════════════════════════════════════════════
  function filterUsers(query) {
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      onlineUsers = allUsers.filter(u => {
        const name = (u.nickName || u.displayName || u.username || '').toLowerCase();
        return name.includes(q);
      });
    } else {
      onlineUsers = allUsers;
    }
    renderUsers();
    hydrateGenders();
  }

  searchInput.on('submit', () => {
    filterUsers(searchInput.getValue());
    focusedPanel = 'users';
    updateFocusIndicators();
    usersList.focus();
  });

  searchInput.on('keypress', (ch, key) => {
    if (key && (key.name === 'escape' || key.name === 'tab' || key.name === 'return' || key.ctrl)) return;
    if (ch) {
      clearTimeout(userSearchTimeout);
      userSearchTimeout = setTimeout(() => filterUsers(searchInput.getValue()), 80);
    }
  });

  searchInput.on('cancel', () => {
    searchInput.clearValue();
    onlineUsers = allUsers;
    renderUsers();
    focusedPanel = 'users';
    updateFocusIndicators();
    usersList.focus();
    screen.render();
  });

  // Backtick → search focus (unless already typing in an input)
  const onBacktick = () => {
    if (!searchInput.parent) return; // lobby already destroyed
    if (screen.focused === searchInput || screen.focused === commandInput) return;
    focusedPanel = 'search';
    updateFocusIndicators();
    searchInput.focus();
    screen.render();
  };
  screen.key(['`'], onBacktick);

  // ══════════════════════════════════════════════════════════════
  //  SOCKET EVENTS (named so they can be removed on destroy)
  // ══════════════════════════════════════════════════════════════
  const onUserStatusChanged = (data) => {
    let known = false;

    const u = allUsers.find(u => u.userId === data.userId);
    if (u) {
      u.status = data.status;
      known = true;
    }
    const ou = onlineUsers.find(u => u.userId === data.userId);
    if (ou) {
      ou.status = data.status;
      known = true;
    }
    const chat = privateChats.find(c => c.otherUser && c.otherUser.userId === data.userId);
    if (chat && chat.otherUser) {
      chat.otherUser.status = data.status;
      known = true;
    }

    if (known) {
      renderUsers();
      renderDMs();
    } else if (data.status === 'online') {
      loadData();
    }
  };

  const onUserJoined = () => loadData();
  const onUserLeft = () => loadData();
  const onUserLoggedOut = () => loadData();

  const onRoomNotification = (data) => {
    const room = rooms.find(r => r.roomId === data.roomId);
    if (room) {
      room.unreadCount = (room.unreadCount || 0) + 1;
      renderRooms();
    }
  };

  const onPrivateMessageLobby = (data) => {
    if (data.senderId === user.userId) return;

    // Instant feedback: bump unread for a known chat
    const chat = privateChats.find(c => c.otherUser && c.otherUser.userId === data.senderId);
    if (chat) {
      chat.unreadCount = (chat.unreadCount || 0) + 1;
      renderDMs();
    }

    // Then refetch the inbox so new senders / server counts are picked up
    refreshDMs();
  };

  socket.on('user_status_changed', onUserStatusChanged);
  socket.on('user_joined', onUserJoined);
  socket.on('user_left', onUserLeft);
  socket.on('user-logged-out', onUserLoggedOut);
  socket.on('room_message_notification', onRoomNotification);
  socket.on('private_message', onPrivateMessageLobby);

  // ══════════════════════════════════════════════════════════════
  //  COMMAND HANDLING
  // ══════════════════════════════════════════════════════════════
  commandInput.on('submit', async () => {
    const cmd = commandInput.getValue().trim();
    commandInput.setValue('');

    if (!cmd) {
      focusedPanel = 'rooms';
      updateFocusIndicators();
      roomsList.focus();
      screen.render();
      return;
    }

    if (cmd.startsWith('/')) {
      await handleCommand(cmd);
    } else {
      setStatus(`{yellow-fg}Commands must start with /{/yellow-fg}`);
      focusedPanel = 'rooms';
      updateFocusIndicators();
      roomsList.focus();
      screen.render();
    }
  });

  function setStatus(msg) {
    statusText.setContent(` ${msg}`);
    screen.render();
  }

  async function handleCommand(cmd) {
    const parts = cmd.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/help':
        showHelp();
        break;

      case '/theme':
        if (parts[1]) {
          const themeName = parts[1];
          if (getThemeNames().includes(themeName)) {
            setTheme(themeName);
            saveConfig({ ...config, theme: themeName });
            if (onThemeChange) onThemeChange();
            return;
          } else {
            setStatus(`{red-fg}Unknown theme: ${themeName}  available: ${getThemeNames().join(', ')}{/red-fg}`);
          }
        } else {
          setStatus(`{yellow-fg}Available themes: ${getThemeNames().join(', ')}{/yellow-fg}`);
        }
        break;

      case '/logout':
        onLogout();
        break;

      case '/quit':
      case '/exit':
        socket.disconnect();
        process.exit(0);
        break;

      case '/rooms':
        await loadData();
        setStatus(`{green-fg}✓ Refreshed!{/green-fg}`);
        break;

      case '/dms':
        await loadData();
        setStatus(`{green-fg}✓ DMs refreshed!{/green-fg}`);
        break;

      default:
        setStatus(`{red-fg}Unknown command: ${command}  — type /help for list{/red-fg}`);
    }

    focusedPanel = 'rooms';
    updateFocusIndicators();
    roomsList.focus();
    screen.render();
  }

  // ══════════════════════════════════════════════════════════════
  //  HELP DIALOG
  // ══════════════════════════════════════════════════════════════
  let activeDialog = null;

  function showHelp() {
    if (activeDialog) {
      activeDialog.destroy();
      activeDialog = null;
    }

    const helpText = [
      `{bold}{center}╔═══════════════════════════════╗{/center}{/bold}`,
      `{bold}{center}║         SOCIAL CLI HELP        ║{/center}{/bold}`,
      `{bold}{center}╚═══════════════════════════════╝{/center}{/bold}`,
      ``,
      `{bold}{yellow-fg}Commands{/yellow-fg}{/bold}`,
      `  {bold}/help{/bold}          Show this help`,
      `  {bold}/rooms{/bold}         Reload rooms list`,
      `  {bold}/dms{/bold}           Reload direct messages`,
      `  {bold}/theme <name>{/bold}  Change theme`,
      `                 ${getThemeNames().map(t => `{bold}${t}{/bold}`).join('  ')}`,
      `  {bold}/logout{/bold}        Sign out`,
      `  {bold}/quit{/bold}          Exit app`,
      ``,
      `{bold}{yellow-fg}Navigation{/yellow-fg}{/bold}`,
      `  {bold}Tab{/bold}       Switch panels (Rooms ↔ DMs ↔ Users)`,
      `  {bold}Enter{/bold}     Open room or start DM`,
      `  {bold}↑ ↓{/bold}       Move selection in list`,
      `  {bold}PgUp/Dn{/bold}   Scroll list`,
      `  {bold}Esc{/bold}       Focus command input`,
      `  {bold}\`{/bold}         Focus user search`,
      ``,
      `{bold}{yellow-fg}Keyboard shortcuts{/yellow-fg}{/bold}`,
      `  {bold}F1{/bold}   Help     {bold}F5{/bold}   Refresh`,
    ].join('\n');

    activeDialog = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '72%',
      height: '80%',
      border: { type: 'line' },
      style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.accent } },
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { style: { bg: theme.border } },
      padding: { top: 1, left: 2, right: 2, bottom: 1 },
    });

    blessed.text({
      parent: activeDialog,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      content: helpText,
      tags: true,
      style: { fg: theme.fg },
    });

    blessed.text({
      parent: activeDialog,
      bottom: 0,
      left: 'center',
      width: 30,
      height: 1,
      content: '{center}{gray-fg}[ Esc / Enter / Q to close ]{/gray-fg}{/center}',
      tags: true,
      style: {},
    });

    activeDialog.key(['escape', 'enter', 'q'], () => {
      activeDialog.destroy();
      activeDialog = null;
      focusedPanel = 'rooms';
      updateFocusIndicators();
      roomsList.focus();
      screen.render();
    });

    activeDialog.focus();
    screen.render();
  }

  // ══════════════════════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  //  NOTE: bound to `screen` (not container) — blessed only sends
  //  key events to the focused element, and container is never the
  //  focused element, so container.key() handlers never fire.
  // ══════════════════════════════════════════════════════════════
  const onF1 = () => handleCommand('/help');
  const onF5 = () => loadData().then(() => setStatus(`{green-fg}✓ Refreshed!{/green-fg}`));
  screen.key(['f1'], onF1);
  screen.key(['f5'], onF5);

  function switchPanel() {
    if (focusedPanel === 'rooms') {
      focusedPanel = 'dms';
      dmList.focus();
    } else if (focusedPanel === 'dms') {
      focusedPanel = 'users';
      usersList.focus();
    } else {
      focusedPanel = 'rooms';
      roomsList.focus();
    }
    updateFocusIndicators();
    screen.render();
  }

  roomsList.key(['tab'], switchPanel);
  dmList.key(['tab'], switchPanel);
  usersList.key(['tab'], switchPanel);
  searchInput.key(['tab'], switchPanel);

  // Esc from list → command input
  roomsList.key(['escape'], () => {
    commandInput.focus();
    screen.render();
  });
  dmList.key(['escape'], () => {
    commandInput.focus();
    screen.render();
  });
  usersList.key(['escape'], () => {
    commandInput.focus();
    screen.render();
  });

  // Esc from command input → back to rooms
  commandInput.key(['escape'], () => {
    commandInput.clearValue();
    focusedPanel = 'rooms';
    updateFocusIndicators();
    roomsList.focus();
    screen.render();
  });

  // ══════════════════════════════════════════════════════════════
  //  BOOT
  // ══════════════════════════════════════════════════════════════
  loadData();

  focusedPanel = 'rooms';
  updateFocusIndicators();
  roomsList.focus();
  screen.render();

  return {
    destroy() {
      screen.unkey(['f1'], onF1);
      screen.unkey(['f5'], onF5);
      screen.unkey(['`'], onBacktick);
      socket.off('user_status_changed', onUserStatusChanged);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('user-logged-out', onUserLoggedOut);
      socket.off('room_message_notification', onRoomNotification);
      socket.off('private_message', onPrivateMessageLobby);
      container.destroy();
    },
    show() {
      container.show();
      focusedPanel = 'rooms';
      updateFocusIndicators();
      roomsList.focus();
      screen.render();
    },
    hide() {
      container.hide();
      screen.render();
    },
    refresh() {
      loadData();
    },
  };
}
