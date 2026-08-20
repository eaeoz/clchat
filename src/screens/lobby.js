import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme, getThemeNames, setTheme } from '../themes/index.js';
import { loadConfig, saveConfig } from '../utils/storage.js';
import { truncate, formatRelativeTime, getTerminalSize } from '../utils/terminal.js';

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
    left: 1,
    width: '100%-3',
    height: 1,
    content: panelTitle('📡', 'Rooms'),
    tags: true,
    style: { fg: theme.primary, bg: theme.panelHeaderBg || theme.headerBg, bold: true },
  });

  // Focus indicator (top border accent line)
  const roomsFocusBorder = blessed.text({
    parent: leftPanel,
    top: 1,
    left: 0,
    width: '100%',
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.border, bg: theme.bg },
  });

  const roomsList = blessed.list({
    parent: leftPanel,
    top: 2,
    left: 0,
    width: '100%',
    bottom: 0,
    tags: true,
    style: {
      selected: { fg: theme.buttonFg, bg: theme.listSelected, bold: true },
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
    left: 1,
    width: '100%-3',
    height: 1,
    content: panelTitle('💬', 'Direct Messages'),
    tags: true,
    style: { fg: theme.primary, bg: theme.panelHeaderBg || theme.headerBg, bold: true },
  });

  const dmFocusBorder = blessed.text({
    parent: middlePanel,
    top: 1,
    left: 0,
    width: '100%',
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.border, bg: theme.bg },
  });

  // Search
  const searchInput = blessed.textbox({
    parent: middlePanel,
    top: 2,
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

  const dmList = blessed.list({
    parent: middlePanel,
    top: 5,
    left: 0,
    width: '100%',
    bottom: 0,
    tags: true,
    style: {
      selected: { fg: theme.buttonFg, bg: theme.listSelected, bold: true },
      item: { fg: theme.fg },
    },
    keys: true,
    mouse: true,
    scrollbar: { style: { bg: theme.border }, track: { bg: theme.sidebarBg || theme.inputBg } },
  });

  // ── RIGHT PANEL — Info + quick help ───────────────────────────
  const rightPanel = blessed.box({
    parent: mainArea,
    right: 0,
    width: '33%',
    height: '100%',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  blessed.text({
    parent: rightPanel,
    top: 0,
    left: 1,
    width: '100%-3',
    height: 1,
    content: ` ℹ  QUICK HELP`,
    tags: true,
    style: { fg: theme.primary, bg: theme.panelHeaderBg || theme.headerBg, bold: true },
  });

  blessed.text({
    parent: rightPanel,
    top: 2,
    left: 2,
    right: 2,
    height: '100%-4',
    content: [
      `{bold}Navigation{/bold}`,
      ``,
      ` Tab        Switch panels`,
      ` Enter      Open room / DM`,
      ` Esc → /    Command input`,
      ` \`           Search users`,
      ` ↑ ↓        Move in list`,
      ` PgUp/PgDn  Scroll list`,
      ``,
      `{bold}Commands{/bold}`,
      ``,
      ` /help      Show full help`,
      ` /dms       Reload DMs`,
      ` /rooms     Reload rooms`,
      ` /theme <n> Change theme`,
      ` /logout    Sign out`,
      ` /quit      Exit`,
      ``,
      `{bold}Shortcuts{/bold}`,
      ``,
      ` F1  Help`,
      ` F5  Refresh`,
    ].join('\n'),
    tags: true,
    style: { fg: theme.fg, bg: theme.bg },
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
    content: '{center}Tab panels  ·  Enter select  ·  ` search  ·  Esc command  ·  F1 help  ·  F5 refresh{/center}',
    tags: true,
    style: { fg: theme.dimFg || theme.muted, bg: theme.statusBarBg },
  });

  // ══════════════════════════════════════════════════════════════
  //  STATE
  // ══════════════════════════════════════════════════════════════
  let rooms = [];
  let privateChats = [];       // DM inbox
  let onlineUsers = [];        // search-result users
  let allUsers = [];
  let dmMode = true;           // middle panel shows DMs by default; false = user search results
  let userSearchTimeout = null;
  let focusedPanel = 'rooms';  // 'rooms' | 'dms' | 'search'

  // ══════════════════════════════════════════════════════════════
  //  FOCUS INDICATOR
  // ══════════════════════════════════════════════════════════════
  function updateFocusIndicators() {
    // Rooms panel top line
    roomsFocusBorder.style.bg = focusedPanel === 'rooms' ? (theme.activeTab || theme.primary) : theme.border;
    // DM/search panel top line
    dmFocusBorder.style.bg = (focusedPanel === 'dms' || focusedPanel === 'search')
      ? (theme.activeTab || theme.primary)
      : theme.border;
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
      privateChats = dmsData.chats || [];

      renderRooms();
      renderDMs();

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

  // ── DMs panel — switches between DM inbox and user search ─────
  function renderDMs() {
    if (dmMode) {
      const header = panelTitle('💬', 'Direct Messages', privateChats.reduce((s, c) => s + (c.unreadCount || 0), 0) || null);
      dmHeader.setContent(header);

      const items = privateChats.map(chat => {
        const other = chat.otherUser || {};
        const name = truncate(other.nickName || other.displayName || other.username || '?', 18);
        const status = other.status === 'online'
          ? `{green-fg}●{/green-fg}`
          : `{gray-fg}○{/gray-fg}`;
        const unread = unreadBadge(chat.unreadCount);
        return ` ${status} ${name}${unread}`;
      });
      dmList.setItems(
        items.length > 0 ? items : [' {gray-fg}No conversations yet{/gray-fg}']
      );
    } else {
      dmHeader.setContent(` 🔍 USER SEARCH RESULTS`);
      const items = onlineUsers.map(u => {
        const name = truncate(u.nickName || u.displayName || u.username, 18);
        const gender = (u.gender || '').toLowerCase();
        const gIcon = gender === 'male' ? '{blue-fg}♂{/blue-fg}' : gender === 'female' ? '{red-fg}♀{/red-fg}' : '';
        const status = u.status === 'online'
          ? `{green-fg}●{/green-fg}`
          : `{gray-fg}○{/gray-fg}`;
        const age = u.age ? ` {gray-fg}(${u.age}){/gray-fg}` : '';
        return ` ${status} ${gIcon} ${name}${age}`;
      });
      dmList.setItems(
        items.length > 0 ? items : [' {gray-fg}No users found{/gray-fg}']
      );
    }
    screen.render();
  }

  // ══════════════════════════════════════════════════════════════
  //  SELECTION HANDLERS
  // ══════════════════════════════════════════════════════════════
  roomsList.on('select', (item, index) => {
    if (rooms[index]) onJoinRoom(rooms[index]);
  });

  dmList.on('select', (item, index) => {
    if (dmMode) {
      const chat = privateChats[index];
      if (chat && chat.otherUser) onOpenChat(chat.otherUser);
    } else {
      if (onlineUsers[index]) onOpenChat(onlineUsers[index]);
    }
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
      dmMode = false;
    } else {
      onlineUsers = allUsers;
      dmMode = true;
    }
    renderDMs();
  }

  searchInput.on('submit', () => {
    filterUsers(searchInput.getValue());
    focusedPanel = 'dms';
    updateFocusIndicators();
    dmList.focus();
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
    dmMode = true;
    onlineUsers = allUsers;
    renderDMs();
    focusedPanel = 'dms';
    updateFocusIndicators();
    dmList.focus();
    screen.render();
  });

  // Backtick → search focus
  screen.key(['`'], () => {
    focusedPanel = 'search';
    updateFocusIndicators();
    searchInput.focus();
    screen.render();
  });

  // ══════════════════════════════════════════════════════════════
  //  SOCKET EVENTS (named so they can be removed on destroy)
  // ══════════════════════════════════════════════════════════════
  const onUserStatusChanged = (data) => {
    const u = allUsers.find(u => u.userId === data.userId);
    if (u) {
      u.status = data.status;
      if (!dmMode) renderDMs();
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
    // Bump unread for matching DM
    const chat = privateChats.find(c => c.otherUser && c.otherUser.userId === data.senderId);
    if (chat) {
      chat.unreadCount = (chat.unreadCount || 0) + 1;
      if (dmMode) renderDMs();
    } else {
      loadData();
    }
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
        dmMode = true;
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
      `  {bold}Tab{/bold}       Switch between panels (Rooms ↔ DMs)`,
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
  // ══════════════════════════════════════════════════════════════
  container.key(['f1'], () => handleCommand('/help'));
  container.key(['f5'], () => loadData().then(() => setStatus(`{green-fg}✓ Refreshed!{/green-fg}`)));

  function switchPanel() {
    if (focusedPanel === 'rooms') {
      focusedPanel = 'dms';
      dmList.focus();
    } else {
      focusedPanel = 'rooms';
      roomsList.focus();
    }
    updateFocusIndicators();
    screen.render();
  }

  roomsList.key(['tab'], switchPanel);
  dmList.key(['tab'], switchPanel);
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

  // Esc from command input → back to rooms
  commandInput.key(['escape'], () => {
    commandInput.setValue('');
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
