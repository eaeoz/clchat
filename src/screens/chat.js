import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { truncate, formatTimestamp } from '../utils/terminal.js';

function hexToBlessed(hex) {
  if (!hex) return 'white';
  const map = {
    '#1a1a2e': 'black', '#0f0f23': 'black', '#000000': 'black', '#0d0500': 'black',
    '#061020': 'black', '#001e27': 'black', '#1e1f29': 'black', '#1a0a00': 'black',
    '#0a1628': 'black', '#002b36': 'black', '#282a36': 'black',
    '#e94560': 'red', '#ff5555': 'red', '#ee5a24': 'red', '#dc322f': 'red', '#ff3300': 'red',
    '#ff6600': 'red', '#ff79c6': 'magenta',
    '#667eea': 'blue', '#48dbfb': 'cyan', '#268bd2': 'blue', '#bd93f9': 'magenta',
    '#764ba2': 'magenta', '#6c71c4': 'magenta', '#0abde3': 'cyan',
    '#e0e0e0': 'white', '#c8d6e5': 'white', '#f8f8f2': 'white', '#839496': 'white',
    '#00ff00': 'green', '#50fa7b': 'green', '#10ac84': 'green', '#859900': 'green',
    '#00ff41': 'green', '#4ade80': 'green',
    '#6b7280': 'black', '#576574': 'black', '#586e75': 'black', '#6272a4': 'black',
    '#fbbf24': 'yellow', '#feca57': 'yellow', '#f1fa8c': 'yellow', '#b58900': 'yellow',
    '#ffff00': 'yellow',
    '#44475a': 'black', '#073642': 'black', '#1e3a5f': 'blue', '#0d1f3c': 'black',
    '#003300': 'green', '#001a00': 'green', '#221100': 'black', '#331100': 'black',
  };
  return map[hex.toLowerCase()] || 'white';
}

export default function createChatScreen(screen, user, room, privateChat, onBack) {
  const theme = getCurrentTheme();
  const isPrivate = !!privateChat;
  const targetName = isPrivate
    ? (privateChat.nickName || privateChat.displayName || privateChat.username)
    : (room.name || 'Room');
  const targetId = isPrivate ? privateChat.userId : room.roomId;

  const senderColor = hexToBlessed(theme.primary);
  const otherColor = hexToBlessed(theme.secondary);
  const mutedColor = hexToBlessed(theme.muted);

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

  const backBtn = blessed.text({
    parent: header,
    left: 0,
    width: 8,
    height: '100%',
    content: ' {bold}\u2190 ESC{/bold} ',
    tags: true,
    style: { fg: theme.accent, bg: theme.headerBg },
    clickable: true,
  });

  const chatTitle = blessed.text({
    parent: header,
    left: 8,
    width: '60%',
    height: '100%',
    content: ` ${isPrivate ? '\u{1F4AC}' : '\u{1F4E1}'} ${targetName}`,
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
  });

  const headerInfo = blessed.text({
    parent: header,
    right: 1,
    width: '30%',
    height: '100%',
    content: isPrivate
      ? (privateChat.status === 'online' ? '{green-fg}\u25cf Online{/}' : '{black-fg}\u25cb Offline{/}')
      : '',
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
    align: 'right',
  });

  // Messages area
  const messagesBox = blessed.box({
    parent: container,
    top: 3,
    left: 0,
    width: '100%',
    height: '100%-8',
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    scrollbar: { style: { bg: theme.border } },
    style: { bg: theme.bg },
    padding: { left: 1, right: 1 },
  });

  // Typing indicator
  const typingBox = blessed.text({
    parent: container,
    bottom: 4,
    left: 1,
    width: '100%-2',
    height: 1,
    content: '',
    tags: true,
    style: { fg: 'yellow' },
  });

  // Input area - wrapper box with border, textbox inside
  const inputWrapper = blessed.box({
    parent: container,
    bottom: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      border: { fg: theme.border },
    },
  });

  // Bottom hints bar
  const hintsBar = blessed.text({
    parent: container,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' {gray-fg}Esc: back \u00b7 Enter: send \u00b7 PgUp/PgDn: scroll \u00b7 /clear: clear{/gray-fg}',
    tags: true,
    style: { bg: theme.statusBarBg },
  });

  const messageInput = blessed.textbox({
    parent: inputWrapper,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    style: {
      fg: theme.fg,
      bg: theme.bg,
    },
    inputOnFocus: true,
    placeholder: ` Message ${targetName}...`,
  });

  // State
  let messages = [];
  let typingTimeout = null;
  let isTyping = false;
  let typingUsers = new Map();
  let nicknameMap = new Map();

  // Load messages
  async function loadMessages() {
    try {
      if (isPrivate) {
        socket.getPrivateMessages(user.userId, targetId);
      } else {
        socket.getRoomMessages(targetId);
      }
    } catch (error) {
      addSystemMessage('Failed to load messages');
    }
  }

  function renderMessages() {
    if (messages.length === 0) {
      messagesBox.setContent('  {black-fg}No messages yet. Start the conversation!{/}');
      screen.render();
      return;
    }

    const lines = [];
    for (const msg of messages) {
      const isOwn = msg.senderId === user.userId;
      const time = formatTimestamp(msg.timestamp);
      const sender = truncate(msg.senderName || 'Unknown', 15);
      if (msg.senderId && msg.senderName) {
        nicknameMap.set(msg.senderId, msg.senderName);
      }

      if (msg.messageType === 'call-log') {
        lines.push(`  {${mutedColor}-fg}\u{1F4DE} ${msg.content} (${time}){/}`);
        continue;
      }

      const nameTag = isOwn ? senderColor : otherColor;
      lines.push(`  {${nameTag}-fg}{bold}${sender}{/bold} {${mutedColor}-fg}${time}{/}`);
      lines.push(`  ${msg.content}`);
      lines.push('');
    }

    messagesBox.setContent(lines.join('\n'));
    const scrollHeight = messagesBox.getScrollHeight();
    const clientHeight = messagesBox.height;
    messagesBox.scrollTo(Math.max(0, scrollHeight - clientHeight));
    screen.render();
  }

  function addSystemMessage(text) {
    messages.push({
      senderId: 'system',
      senderName: '',
      content: `\u{2139} ${text}`,
      timestamp: new Date(),
      messageType: 'system',
    });
    renderMessages();
  }

  // Socket event handlers
  function onRoomMessages(data) {
    if (isPrivate) return;
    if (data.roomId !== targetId) return;
    messages = data.messages || [];
    renderMessages();
  }

  function onPrivateMessages(data) {
    if (!isPrivate) return;
    if (data.otherUserId !== targetId) return;
    messages = data.messages || [];
    renderMessages();
  }

  function onRoomMessage(msg) {
    if (isPrivate) return;
    if (msg.senderId === user.userId) return;
    messages.push(msg);
    renderMessages();
  }

  function onPrivateMessage(msg) {
    if (!isPrivate) return;
    if (msg.senderId !== user.userId && msg.senderId !== targetId) return;
    messages.push(msg);
    renderMessages();
  }

  async function fetchNickname(userId) {
    if (nicknameMap.has(userId)) return;
    try {
      const data = await api.getUserProfile(userId);
      const profile = data.user || data;
      const nick = profile.nickName || profile.displayName;
      if (nick) nicknameMap.set(userId, nick);
      if (typingUsers.has(userId)) updateTypingIndicator();
    } catch {}
  }

  function onUserTyping(data) {
    if (data.userId === user.userId) return;
    typingUsers.set(data.userId, data.username);
    if (!nicknameMap.has(data.userId)) fetchNickname(data.userId);
    updateTypingIndicator();
  }

  function onUserStopTyping(data) {
    typingUsers.delete(data.userId);
    updateTypingIndicator();
  }

  function updateTypingIndicator() {
    if (typingUsers.size === 0) {
      typingBox.setContent('');
    } else {
      const names = Array.from(typingUsers.keys()).map(uid => nicknameMap.get(uid) || typingUsers.get(uid));
      const joined = names.join(', ');
      const verb = typingUsers.size === 1 ? 'is' : 'are';
      typingBox.setContent(`${joined} ${verb} typing...`);
    }
    screen.render();
  }

  // Register socket listeners
  socket.on('room_messages', onRoomMessages);
  socket.on('private_messages', onPrivateMessages);
  socket.on('room_message', onRoomMessage);
  socket.on('private_message', onPrivateMessage);
  socket.on('user_typing', onUserTyping);
  socket.on('user_stop_typing', onUserStopTyping);

  // Send message
  function sendMessage(text) {
    if (!text || !text.trim()) return;

    const content = text.trim();

    // Optimistic add
    messages.push({
      senderId: user.userId,
      senderName: user.nickName || user.username,
      content,
      timestamp: new Date(),
      messageType: 'text',
    });
    renderMessages();

    if (isPrivate) {
      socket.sendPrivateMessage(targetId, user.userId, user.username, content);
    } else {
      socket.sendRoomMessage(targetId, user.userId, user.username, content);
    }
  }

  // Input handling
  let lastInputTime = 0;

  messageInput.on('submit', (text) => {
    if (!text || !text.trim()) return;

    const trimmed = text.trim();

    if (trimmed.startsWith('/')) {
      const cmd = trimmed.split(' ')[0].toLowerCase();
      switch (cmd) {
        case '/back':
        case '/quit':
          cleanup();
          onBack();
          return;
        case '/clear':
          messages = [];
          renderMessages();
          return;
        case '/scroll-top':
          messagesBox.scrollTo(0);
          screen.render();
          return;
        case '/scroll-bottom': {
          const sh = messagesBox.getScrollHeight();
          const ch = messagesBox.height;
          messagesBox.scrollTo(Math.max(0, sh - ch));
          screen.render();
          return;
        }
      }
    }

    sendMessage(trimmed);

    // Clear input - safe now because border is on the wrapper, not the textbox
    messageInput.setValue('');
    messageInput.focus();

    if (isTyping) {
      isTyping = false;
      socket.sendStopTyping(isPrivate ? null : targetId, user.userId, user.username, isPrivate, isPrivate ? targetId : null);
    }

    screen.render();
  });

  messageInput.on('keypress', () => {
    const now = Date.now();
    if (now - lastInputTime > 2000) {
      lastInputTime = now;
      if (!isTyping) {
        isTyping = true;
        socket.sendTyping(isPrivate ? null : targetId, user.userId, user.username, isPrivate, isPrivate ? targetId : null);
      }
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (isTyping) {
        isTyping = false;
        socket.sendStopTyping(isPrivate ? null : targetId, user.userId, user.username, isPrivate, isPrivate ? targetId : null);
      }
    }, 3000);
  });

  // Navigation - bind escape on input so it works even while typing
  backBtn.on('click', () => {
    cleanup();
    onBack();
  });

  messageInput.key(['escape'], () => {
    cleanup();
    onBack();
  });

  container.key(['escape'], () => {
    cleanup();
    onBack();
  });

  container.key(['pageup'], () => {
    messagesBox.scrollUp(5);
    screen.render();
  });

  container.key(['pagedown'], () => {
    messagesBox.scrollDown(5);
    screen.render();
  });

  container.key(['home'], () => {
    messagesBox.scrollTo(0);
    screen.render();
  });

  container.key(['end'], () => {
    const sh = messagesBox.getScrollHeight();
    const ch = messagesBox.height;
    messagesBox.scrollTo(Math.max(0, sh - ch));
    screen.render();
  });

  function cleanup() {
    socket.off('room_messages', onRoomMessages);
    socket.off('private_messages', onPrivateMessages);
    socket.off('room_message', onRoomMessage);
    socket.off('private_message', onPrivateMessage);
    socket.off('user_typing', onUserTyping);
    socket.off('user_stop_typing', onUserStopTyping);

    if (!isPrivate) {
      socket.leaveRoom(targetId, user.userId, user.username);
    }
  }

  if (!isPrivate) {
    socket.joinRoom(targetId, user.userId, user.username);
  }

  loadMessages();
  messageInput.focus();
  screen.render();

  return {
    destroy() {
      cleanup();
      container.destroy();
    },
    show() {
      container.show();
      messageInput.focus();
      screen.render();
    },
    hide() {
      container.hide();
      screen.render();
    },
  };
}
