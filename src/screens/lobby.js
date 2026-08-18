import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme, getThemeNames, setTheme } from '../themes/index.js';
import { loadConfig, saveConfig } from '../utils/storage.js';
import { truncate, formatRelativeTime, padRight } from '../utils/terminal.js';

export default function createLobbyScreen(screen, user, onJoinRoom, onOpenChat, onLogout, onThemeChange) {
  const theme = getCurrentTheme();
  const config = loadConfig();

  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  // Header
  const header = blessed.box({
    parent: container,
    top: 0,
    width: '100%',
    height: 3,
    style: { bg: theme.headerBg },
  });

  const headerTitle = blessed.text({
    parent: header,
    left: 1,
    width: '40%',
    height: '100%',
    content: ` {bold}Social CLI{/bold} `,
    tags: true,
    style: { fg: theme.accent, bg: theme.headerBg },
  });

  const headerUser = blessed.text({
    parent: header,
    right: 1,
    width: '40%',
    height: '100%',
    content: `{right}\u{1F464} ${user.username} {/right}`,
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
    align: 'right',
  });

  // Status bar
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
    width: '60%',
    height: '100%',
    content: ` \u25cf Connected`,
    tags: true,
    style: { fg: theme.success, bg: theme.statusBarBg },
  });

  const statusCmds = blessed.text({
    parent: statusBar,
    right: 1,
    width: '40%',
    height: '100%',
    content: `{right}/help \u00b7 /quit{/right}`,
    tags: true,
    style: { fg: theme.muted, bg: theme.statusBarBg },
    align: 'right',
  });

  // Main content area
  const mainArea = blessed.box({
    parent: container,
    top: 4,
    width: '100%',
    height: '100%-4',
  });

  // Left panel - Rooms
  const leftPanel = blessed.box({
    parent: mainArea,
    left: 0,
    width: '33%',
    height: '100%',
    border: { type: 'line', left: false, top: false, bottom: false },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const roomsHeader = blessed.text({
    parent: leftPanel,
    top: 0,
    left: 1,
    width: '100%-2',
    height: 1,
    content: ' \u{1F3E0} ROOMS',
    style: { fg: theme.primary, bg: theme.bg },
  });

  const roomsList = blessed.list({
    parent: leftPanel,
    top: 1,
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
    scrollbar: { style: { bg: theme.border } },
  });

  // Middle panel - Users
  const middlePanel = blessed.box({
    parent: mainArea,
    left: '33%',
    width: '34%',
    height: '100%',
    border: { type: 'line', left: false, top: false, bottom: false },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const usersHeader = blessed.text({
    parent: middlePanel,
    top: 0,
    left: 1,
    width: '100%-2',
    height: 1,
    content: ' \u{1F465} USERS',
    style: { fg: theme.primary, bg: theme.bg },
  });

  const searchInput = blessed.textbox({
    parent: middlePanel,
    top: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    inputOnFocus: true,
    placeholder: ' Search users...',
  });

  const usersList = blessed.list({
    parent: middlePanel,
    top: 4,
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
    scrollbar: { style: { bg: theme.border } },
  });

  // Right panel - Instructions
  const rightPanel = blessed.box({
    parent: mainArea,
    right: 0,
    width: '33%',
    height: '100%',
    style: { bg: theme.bg },
  });

  const welcomeBox = blessed.box({
    parent: rightPanel,
    top: 0,
    left: 'center',
    width: '90%',
    height: '50%',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const welcomeContent = blessed.text({
    parent: welcomeBox,
    top: 1,
    left: 1,
    width: '100%-2',
    height: '100%-2',
    content: `{center}{bold}Welcome to Social CLI{/bold}{/center}\n\n{center}Select a room or user to{/center}\n{center}start chatting.{/center}\n\n{center}{bold}Commands:{/bold}{/center}\n{center}/help  - Show help{/center}\n{center}/theme - Change theme{/center}\n{center}/logout- Logout{/center}\n{center}/quit  - Exit app{/center}`,
    tags: true,
    style: { fg: theme.fg },
    align: 'center',
    valign: 'middle',
  });

  const hintsBox = blessed.text({
    parent: rightPanel,
    top: '50%+1',
    left: 1,
    width: '100%-2',
    height: '50%-1',
    tags: true,
    content: `{bold}{center}Navigation{/center}{/bold}\n\nTab      Switch panels\nEnter    Select / Open chat\nEsc      Back / Cancel\nUp/Down  Navigate lists\nPgUp/PgDn Scroll\n\n{bold}{center}Tips{/center}{/bold}\n\nType /help for commands\nSearch users above`,
    style: { fg: theme.fg },
    align: 'left',
    valign: 'top',
  });

  // State
  let rooms = [];
  let onlineUsers = [];
  let allUsers = [];
  let userSearchTimeout = null;

  // Load data
  async function loadData() {
    try {
      const [roomsData, usersData] = await Promise.all([
        api.getPublicRooms(),
        api.getUsers(),
      ]);

      rooms = roomsData.rooms || [];
      onlineUsers = usersData.users || [];
      allUsers = onlineUsers;

      renderRooms();
      renderUsers();
    } catch (error) {
      statusText.setContent(` {red-fg}\u25cf Error loading data{/red-fg}`);
      screen.render();
    }
  }

  function renderRooms() {
    const items = rooms.map(r => {
      const unread = r.unreadCount > 0 ? ` {bold}(${r.unreadCount}){/bold}` : '';
      return ` \u{1F535} ${truncate(r.name, 20)}${unread}`;
    });
    roomsList.setItems(items.length > 0 ? items : [' {gray-fg}No rooms available{/gray-fg}']);
    screen.render();
  }

  function renderUsers() {
    const items = onlineUsers.map(u => {
      const status = u.status === 'online' ? '\u{1F7E2}' : '\u{26AB}';
      const name = truncate(u.nickName || u.displayName || u.username, 14);
      const genderIcon = u.gender === 'male' ? '\u2642' : u.gender === 'female' ? '\u2640' : '\u265F';
      const genderColor = u.gender === 'male' ? 'blue-fg' : u.gender === 'female' ? 'red-fg' : 'white-fg';
      const age = u.age ? ` (${u.age})` : '';
      return ` ${status} {${genderColor}}${name}{/${genderColor}}${age}`;
    });
    usersList.setItems(items.length > 0 ? items : [' {gray-fg}No users online{/gray-fg}']);
    screen.render();
  }

  // Event handlers
  roomsList.on('select', (item, index) => {
    if (rooms[index]) {
      onJoinRoom(rooms[index]);
    }
  });

  usersList.on('select', (item, index) => {
    if (onlineUsers[index]) {
      onOpenChat(onlineUsers[index]);
    }
  });

  searchInput.on('submit', async () => {
    const query = searchInput.getValue().trim();
    if (query.length >= 3) {
      try {
        const data = await api.getUsers(query);
        onlineUsers = data.users || [];
        renderUsers();
      } catch {}
    } else if (query.length === 0) {
      onlineUsers = allUsers;
      renderUsers();
    }
  });

  searchInput.on('cancel', () => {
    searchInput.clearValue();
    onlineUsers = allUsers;
    renderUsers();
    roomsList.focus();
    screen.render();
  });

  // Socket events
  socket.on('user_status_changed', (data) => {
    const user = onlineUsers.find(u => u.userId === data.userId);
    if (user) {
      user.status = data.status;
    } else if (data.status === 'online') {
      loadData();
      return;
    }
    renderUsers();
  });

  socket.on('user_joined', () => loadData());
  socket.on('user_left', () => loadData());
  socket.on('user-logged-out', () => loadData());

  socket.on('room_message_notification', async (data) => {
    const room = rooms.find(r => r.roomId === data.roomId);
    if (room) {
      room.unreadCount = (room.unreadCount || 0) + 1;
      renderRooms();
    }
  });

  // Command input
  // Bottom hints bar
  const hintsBar = blessed.text({
    parent: container,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: '{center}Tab: panels \u00b7 Enter: select \u00b7 /help \u00b7 /logout \u00b7 /quit \u00b7 F1: help \u00b7 F5: refresh{/center}',
    tags: true,
    style: { fg: theme.muted, bg: theme.statusBarBg },
  });

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
      focus: { border: { fg: theme.primary } },
    },
    inputOnFocus: true,
    placeholder: ' Type /help for commands...',
  });

  commandInput.on('submit', async () => {
    const cmd = commandInput.getValue().trim();
    commandInput.setValue('');

    if (!cmd) {
      roomsList.focus();
      screen.render();
      return;
    }

    if (cmd.startsWith('/')) {
      await handleCommand(cmd);
    } else {
      statusText.setContent(` {yellow-fg}Commands start with /{/yellow-fg}`);
      roomsList.focus();
      screen.render();
    }
  });

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
            statusText.setContent(` {red-fg}Unknown theme: ${themeName}. Available: ${getThemeNames().join(', ')}{/red-fg}`);
          }
        } else {
          statusText.setContent(` {yellow-fg}Themes: ${getThemeNames().join(', ')}{/yellow-fg}`);
        }
        screen.render();
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
        statusText.setContent(` {green-fg}Refreshed!{/green-fg}`);
        screen.render();
        break;
      default:
        statusText.setContent(` {red-fg}Unknown command: ${command}{/red-fg}`);
        screen.render();
    }
  }

  let activeDialog = null;

  function showHelp() {
    if (activeDialog) {
      activeDialog.destroy();
      activeDialog = null;
    }

    const helpText = `
{bold}{center}=== COMMANDS ==={/center}{/bold}

  {bold}/help{/bold}        Show this help message
  {bold}/theme <name>{/bold}  Change theme (${getThemeNames().join(', ')})
  {bold}/rooms{/bold}       Refresh rooms list
  {bold}/logout{/bold}      Logout and return to login
  {bold}/quit{/bold}        Exit the application

{bold}{center}=== NAVIGATION ==={/center}{/bold}

  {bold}Tab{/bold}         Switch between panels
  {bold}Enter{/bold}       Select item / Open chat
  {bold}Escape{/bold}      Go back / Cancel
  {bold}Up/Down{/bold}    Navigate lists
`;

    activeDialog = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '70%',
      border: { type: 'line' },
      style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.accent } },
      keys: true,
    });

    const helpContent = blessed.text({
      parent: activeDialog,
      top: 1,
      left: 2,
      width: '100%-4',
      height: '100%-2',
      content: helpText,
      tags: true,
      style: { fg: theme.fg },
    });

    const closeBtn = blessed.text({
      parent: activeDialog,
      bottom: 0,
      left: 'center',
      width: 20,
      height: 1,
      content: '{center}[ Press Esc or Enter to close ]{/center}',
      tags: true,
      style: { fg: theme.muted },
    });

    activeDialog.key(['escape', 'enter', 'q'], () => {
      activeDialog.destroy();
      activeDialog = null;
      roomsList.focus();
      screen.render();
    });

    activeDialog.focus();
    screen.render();
  }

  // Keyboard shortcuts
  container.key(['f1'], () => handleCommand('/help'));
  container.key(['f5'], () => handleCommand('/rooms'));

  let focusedPanel = 'rooms';

  function switchPanel() {
    if (focusedPanel === 'rooms') {
      focusedPanel = 'users';
      usersList.focus();
    } else {
      focusedPanel = 'rooms';
      roomsList.focus();
    }
    screen.render();
  }

  roomsList.key(['tab'], switchPanel);
  usersList.key(['tab'], switchPanel);
  searchInput.key(['tab'], switchPanel);

  roomsList.key(['escape'], () => commandInput.focus());
  usersList.key(['escape'], () => commandInput.focus());
  commandInput.key(['escape'], () => {
    socket.disconnect();
    process.exit(0);
  });

  // Load data
  loadData();

  // Focus
  roomsList.focus();

  screen.render();

  return {
    destroy() {
      container.destroy();
    },
    show() {
      container.show();
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
