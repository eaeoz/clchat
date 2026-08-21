import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { justRead, closeState } from './chat.js';
import { getCurrentTheme, getThemeNames, setTheme } from '../themes/index.js';
import { loadConfig, saveConfig } from '../utils/storage.js';
import { truncate } from '../utils/terminal.js';
import { APP_VERSION } from '../version.js';

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
export default function createLobbyScreen(screen, user, onJoinRoom, onOpenChat, onLogout, onThemeChange, initialPanel = 'rooms') {
  const theme = getCurrentTheme();
  const config = loadConfig();

  // Some themes ship dimFg/muted identical to headerBg/statusBarBg, and
  // 16-color terminals quantize dark hexes into the same ANSI slot either
  // way — dim colors end up invisible. Bars MUST use theme.fg (guaranteed
  // readable); emphasis comes from bold tags instead of darker colors.
  const barFg = theme.fg;

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

  // Version label next to the logo
  blessed.text({
    parent: header,
    top: 1,
    left: 16,
    height: 1,
    content: APP_VERSION ? `v${APP_VERSION}` : '',
    tags: true,
    style: { fg: barFg, bg: theme.headerBg },
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
    content: `{right}{bold}F1{/bold} Help   {bold}F5{/bold} Refresh{/right}`,
    tags: true,
    style: { fg: barFg, bg: theme.statusBarBg },
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
    content: panelTitle('💬', 'New Received'),
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
    content: '{center}{bold}Tab{/bold} panels  ·  {bold}Enter{/bold} select  ·  {bold}`{/bold} search  ·  {bold}Esc{/bold} command  ·  {bold}F1{/bold} help  ·  {bold}F5{/bold} refresh{/center}',    tags: true,
    style: { fg: barFg, bg: theme.statusBarBg },
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
  // Single source of truth for the DM unread total. Applies the same
  // just-read suppression as the row list, so the header badge and the
  // status bar can never disagree with what is actually displayed.
  function dmTotalUnread() {
    return privateChats.reduce((s, c) => {
      const id = c.otherUser && c.otherUser.userId;
      return s + (justRead.has(id) ? 0 : (c.unreadCount || 0));
    }, 0);
  }

  function updateStatusBar() {
    const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount || 0), 0)
      + dmTotalUnread();
    statusText.setContent(
      ` {green-fg}●{/green-fg} Connected` +
      (totalUnread > 0 ? `  {bold}{yellow-fg}[${totalUnread} unread]{/yellow-fg}{/bold}` : '')
    );
    // setContent() clears the element's pixels immediately; without a
    // render here the bar stays blank whenever this runs after the last
    // screen.render() of a refresh (e.g. from the inbox poll).
    screen.render();
  }

  async function loadData() {
    try {
      statusText.setContent(` {yellow-fg}●{/yellow-fg} Loading…`);
      screen.render();

      // Web-client ordering: if a chat was just closed, wait for that
      // request to finish BEFORE fetching the inbox, so the server has
      // already applied state=false and the row is really gone.
      if (closeState.last) {
        await closeState.last;
        closeState.last = null;
      }

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

      updateStatusBar();
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
      if (closeState.last) {
        await closeState.last;
        closeState.last = null;
      }
      const dmsData = api.getPrivateChats ? await api.getPrivateChats() : {};
      privateChats = dmsData.privateChats || dmsData.chats || [];
      renderDMs();
      updateStatusBar();
    } catch { }
  }

  function renderDMs() {
    // Chats that were just read disappear IMMEDIATELY: their unread count
    // is treated as 0 for both the row list and the header total — no
    // waiting for the server's read receipt to catch up. Each entry is
    // released once a fetch confirms the conversation is fully read on
    // the server, or instantly when a new message arrives from them.
    for (const id of justRead) {
      const c = privateChats.find(x => x.otherUser && x.otherUser.userId === id);
      if (!c || (c.unreadCount || 0) === 0) justRead.delete(id);
    }
    const effUnread = (chat) => {
      const id = chat.otherUser && chat.otherUser.userId;
      return justRead.has(id) ? 0 : (chat.unreadCount || 0);
    };

    const header = panelTitle('💬', 'New Received', dmTotalUnread() || null);
    dmHeader.setContent(header);

    // Only show conversations that have unread messages — read ones
    // disappear until a new message arrives
    displayedChats = privateChats.filter(c => effUnread(c) > 0);

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
      // Theme-aware dim color for the age — hardcoded {gray-fg} maps to
      // ANSI bright black, which some terminals render nearly identical
      // to the background (age invisible). theme.muted is tuned per theme.
      const ageColor = theme.muted || theme.dimFg || '#888888';
      const age = u.age ? ` {${ageColor}-fg}(${u.age}){/}` : '';
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
  //  NOTE: rapid/buffered keypresses (e.g. Enter Enter) can reach a
  //  list right after the help dialog closes and focus returns — the
  //  short suppression window stops the closing key from opening a
  //  room/chat by accident.
  // ══════════════════════════════════════════════════════════════
  let suppressSelectUntil = 0;

  roomsList.on('select', (item, index) => {
    if (Date.now() < suppressSelectUntil) return;
    if (rooms[index]) onJoinRoom(rooms[index]);
  });

  dmList.on('select', (item, index) => {
    if (Date.now() < suppressSelectUntil) return;
    const chat = displayedChats[index];
    if (chat && chat.otherUser) onOpenChat(chat.otherUser);
  });

  usersList.on('select', (item, index) => {
    if (Date.now() < suppressSelectUntil) return;
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
      updateStatusBar();
    }
  };

  const onPrivateMessageLobby = (data) => {
    if (data.senderId === user.userId) return;

    // A new message from a just-read user means real unread again —
    // stop suppressing their row
    justRead.delete(data.senderId);

    // Instant feedback: bump unread for a known chat
    const chat = privateChats.find(c => c.otherUser && c.otherUser.userId === data.senderId);
    if (chat) {
      chat.unreadCount = (chat.unreadCount || 0) + 1;
      renderDMs();
      updateStatusBar();
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

  // ── Inbox poll ────────────────────────────────────────────────
  // The just-read suppression only covers chats opened HERE. Reads that
  // happen elsewhere (web/phone) never trigger a socket event, so without
  // a poll those rows would sit forever. 5s matches the web client.
  const dmsPollInterval = setInterval(() => {
    if (!container.detached) refreshDMs();
  }, parseInt(process.env.DM_POLL_MS || '5000', 10));

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
        // The dialog takes focus — do NOT fall through to the tail
        // refocus below, it would steal keys back from the dialog and
        // Enter/Esc would hit the lists behind the overlay instead.
        return;

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
    if (activeDialog) return; // already open

    // Remember which panel was active so closing help restores it
    const prevPanel = focusedPanel;

    const helpText = [
      `{center}{bold}╔═══════════════════════════════╗{/bold}{/center}`,
      `{center}{bold}║         SOCIAL CLI HELP       ║{/bold}{/center}`,
      `{center}{bold}╚═══════════════════════════════╝{/bold}{/center}`,
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
      if (!activeDialog) return;
      const dlg = activeDialog;
      activeDialog = null;

      // Swallow any immediately-following buffered Enter so the closing
      // key can't select an item in the list we're about to focus.
      suppressSelectUntil = Date.now() + 250;

      // Move focus OFF the dialog BEFORE destroying it — blessed crashes
      // (null.ileft in _getLeft) when the focused element is detached
      // mid-dispatch. Restore the panel active before help was opened.
      if (prevPanel === 'dms') {
        focusedPanel = 'dms';
        dmList.focus();
      } else if (prevPanel === 'users' || prevPanel === 'search') {
        focusedPanel = 'users';
        usersList.focus();
      } else {
        focusedPanel = 'rooms';
        roomsList.focus();
      }
      updateFocusIndicators();

      dlg.destroy();
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
  // One follow-up fetch: if a chat was just read and closed, its
  // mark_chat_as_read can land on the server a moment AFTER the first
  // inbox fetch, leaving a ghost row. This second look clears it.
  const bootRefetch = setTimeout(() => {
    refreshDMs();
  }, 2000);

  focusedPanel = initialPanel === 'dms' ? 'dms' : 'rooms';
  updateFocusIndicators();
  (focusedPanel === 'dms' ? dmList : roomsList).focus();
  screen.render();

  return {
    destroy() {
      clearTimeout(bootRefetch);
      clearInterval(dmsPollInterval);
      screen.unkey(['f1'], onF1);
      screen.unkey(['f5'], onF5);
      screen.unkey(['`'], onBacktick);
      socket.off('user_status_changed', onUserStatusChanged);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('user-logged-out', onUserLoggedOut);
      socket.off('room_message_notification', onRoomNotification);
      socket.off('private_message', onPrivateMessageLobby);
      // Never leak the help overlay onto the next view
      if (activeDialog) {
        activeDialog.destroy();
        activeDialog = null;
      }
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
