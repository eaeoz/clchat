import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { truncate, formatTimestamp, formatDate } from '../utils/terminal.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Hex → blessed named-color (fallback map)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
//  Max input chars shown in counter
// ─────────────────────────────────────────────────────────────────────────────
const MAX_MSG_LEN = 2000;

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
export default function createChatScreen(screen, user, room, privateChat, onBack) {
  const theme = getCurrentTheme();
  const isPrivate = !!privateChat;
  const targetName = isPrivate
    ? (privateChat.nickName || privateChat.displayName || privateChat.username)
    : (room.name || 'Room');
  const targetId = isPrivate ? privateChat.userId : room.roomId;

  const ownColor  = hexToBlessed(theme.ownMsg || theme.primary);
  const otherColor = hexToBlessed(theme.otherMsg || theme.secondary);
  const mutedColor = hexToBlessed(theme.muted);

  // ── Root container ────────────────────────────────────────────
  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  // ══════════════════════════════════════════════════════════════
  //  HEADER (3 rows)
  // ══════════════════════════════════════════════════════════════
  const header = blessed.box({
    parent: container,
    top: 0,
    width: '100%',
    height: 3,
    style: { bg: theme.headerBg },
  });

  // Back button
  const backBtn = blessed.text({
    parent: header,
    top: 1,
    left: 1,
    width: 10,
    height: 1,
    content: ' {bold}← ESC{/bold} ',
    tags: true,
    style: { fg: theme.accent, bg: theme.headerBg },
    clickable: true,
  });

  // Vertical divider after back btn
  blessed.text({
    parent: header,
    top: 0,
    left: 11,
    width: 1,
    height: 3,
    content: '│\n│\n│',
    style: { fg: theme.border, bg: theme.headerBg },
  });

  // Chat icon + name
  const chatTitle = blessed.text({
    parent: header,
    top: 1,
    left: 13,
    width: '55%',
    height: 1,
    content: ` ${isPrivate ? '💬' : '📡'} {bold}${targetName}{/bold}`,
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
  });

  // Online status (private) / member count (room)
  const headerInfo = blessed.text({
    parent: header,
    top: 1,
    right: 2,
    width: '25%',
    height: 1,
    content: isPrivate
      ? (privateChat.status === 'online'
          ? '{green-fg}● Online{/green-fg}'
          : '{gray-fg}○ Offline{/gray-fg}')
      : '{gray-fg}public room{/gray-fg}',
    tags: true,
    style: { fg: theme.fg, bg: theme.headerBg },
    align: 'right',
  });

  // ══════════════════════════════════════════════════════════════
  //  MESSAGES AREA
  // ══════════════════════════════════════════════════════════════
  const messagesBox = blessed.box({
    parent: container,
    top: 3,
    left: 0,
    width: '100%',
    bottom: 6,   // typing(1) + inputWrapper(3) + hints(1) + gap(1)
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    scrollbar: {
      style: { bg: theme.border },
      track: { bg: theme.sidebarBg || theme.inputBg },
    },
    style: { bg: theme.bg },
    padding: { left: 1, right: 2, top: 0, bottom: 0 },
    mouse: true,
    keys: true,
  });

  // ── Typing indicator ──────────────────────────────────────────
  const typingBox = blessed.text({
    parent: container,
    bottom: 5,
    left: 2,
    width: '70%',
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.warning, bg: theme.bg },
  });

  // Character counter
  const charCounter = blessed.text({
    parent: container,
    bottom: 5,
    right: 2,
    width: 14,
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.muted, bg: theme.bg },
    align: 'right',
  });

  // ── Input wrapper + textbox ───────────────────────────────────
  const inputWrapper = blessed.box({
    parent: container,
    bottom: 1,
    left: 0,
    width: '100%',
    height: 4,
    border: { type: 'line' },
    style: {
      border: { fg: theme.inputFocusBorder || theme.primary },
      bg: theme.inputBg,
    },
  });

  const messageInput = blessed.textbox({
    parent: inputWrapper,
    top: 0,
    left: 1,
    right: 1,
    // NOTE: never use height:'100%' inside a bordered parent — blessed
    // resolves it against the FULL parent height and the child erases
    // the bottom border row. Anchor with top+bottom instead.
    bottom: 0,
    inputOnFocus: true,
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
    },
    placeholder: `  Message ${targetName}…`,
  });

  // ── Hints bar ─────────────────────────────────────────────────
  const hintsBar = blessed.text({
    parent: container,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' {gray-fg}Enter send  ·  Esc back  ·  PgUp/Dn scroll  ·  Home top  ·  End bottom  ·  /clear  /back{/gray-fg}',
    tags: true,
    style: { bg: theme.statusBarBg },
  });

  // ══════════════════════════════════════════════════════════════
  //  STATE
  // ══════════════════════════════════════════════════════════════
  let messages = [];
  let typingTimeout = null;
  let isTyping = false;
  let typingUsers = new Map();
  let nicknameMap = new Map();

  // ══════════════════════════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════════════════════════

  /** Group consecutive messages from same sender into "blocks" */
  function groupMessages(msgs) {
    const groups = [];
    let prev = null;
    for (const msg of msgs) {
      if (
        prev &&
        prev.senderId === msg.senderId &&
        msg.messageType !== 'system' &&
        msg.messageType !== 'call-log' &&
        (new Date(msg.timestamp) - new Date(prev.lastTimestamp)) < 5 * 60 * 1000
      ) {
        prev.lines.push({ content: msg.content, timestamp: msg.timestamp });
        prev.lastTimestamp = msg.timestamp;
      } else {
        prev = {
          senderId: msg.senderId,
          senderName: msg.senderName,
          firstTimestamp: msg.timestamp,
          lastTimestamp: msg.timestamp,
          messageType: msg.messageType,
          lines: [{ content: msg.content, timestamp: msg.timestamp }],
        };
        groups.push(prev);
      }
    }
    return groups;
  }

  /** Build a date separator line */
  function dateSeparator(ts) {
    const label = formatDate(ts);
    return `  {gray-fg}──────── ${label} ────────{/gray-fg}`;
  }

  function renderMessages() {
    if (messages.length === 0) {
      messagesBox.setContent('  {gray-fg}No messages yet. Say hello!{/gray-fg}');
      screen.render();
      return;
    }

    const lines = [];
    let lastDay = null;
    const groups = groupMessages(messages);

    for (const group of groups) {
      const ts = new Date(group.firstTimestamp);
      const day = ts.toDateString();

      if (day !== lastDay) {
        if (lastDay !== null) lines.push('');
        lines.push(dateSeparator(group.firstTimestamp));
        lines.push('');
        lastDay = day;
      }

      const isOwn = group.senderId === user.userId;
      const isSystem = group.messageType === 'system';
      const isCallLog = group.messageType === 'call-log';

      if (isSystem || isCallLog) {
        for (const l of group.lines) {
          lines.push(`  {${mutedColor}-fg}ℹ ${l.content}{/}`);
        }
        lines.push('');
        continue;
      }

      const time = formatTimestamp(group.firstTimestamp);
      const senderLabel = truncate(group.senderName || 'Unknown', 18);

      if (group.senderId && group.senderName) {
        nicknameMap.set(group.senderId, group.senderName);
      }

      const nameColor = isOwn ? ownColor : otherColor;
      const prefix = isOwn ? '  ▶' : '  ◀';

      // Header line: prefix + name + time
      lines.push(
        `${prefix} {${nameColor}-fg}{bold}${senderLabel}{/bold}{/} {${mutedColor}-fg}${time}{/}`
      );

      // Content lines (indented)
      for (const l of group.lines) {
        lines.push(`     ${l.content}`);
      }
      lines.push('');
    }

    messagesBox.setContent(lines.join('\n'));
    scrollToBottom();
    screen.render();
  }

  function scrollToBottom() {
    const sh = messagesBox.getScrollHeight();
    const ch = messagesBox.height;
    messagesBox.scrollTo(Math.max(0, sh - ch));
  }

  function addSystemMessage(text) {
    messages.push({
      senderId: 'system',
      senderName: '',
      content: text,
      timestamp: new Date(),
      messageType: 'system',
    });
    renderMessages();
  }

  // ══════════════════════════════════════════════════════════════
  //  SOCKET HANDLERS
  // ══════════════════════════════════════════════════════════════
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
    // Live read receipt for messages read while the chat is open
    if (msg.senderId !== user.userId && msg.messageId) {
      socket.markAsRead(msg.messageId);
    }
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
      const names = Array.from(typingUsers.keys())
        .map(uid => nicknameMap.get(uid) || typingUsers.get(uid));
      const joined = names.join(', ');
      const verb = typingUsers.size === 1 ? 'is' : 'are';
      typingBox.setContent(`{${mutedColor}-fg}✎ ${joined} ${verb} typing…{/}`);
    }
    screen.render();
  }

  function onUserStatusChanged(data) {
    if (isPrivate && data.userId === targetId) {
      headerInfo.setContent(
        data.status === 'online'
          ? '{green-fg}● Online{/green-fg}'
          : '{gray-fg}○ Offline{/gray-fg}'
      );
      screen.render();
    }
  }

  socket.on('room_messages', onRoomMessages);
  socket.on('private_messages', onPrivateMessages);
  socket.on('room_message', onRoomMessage);
  socket.on('private_message', onPrivateMessage);
  socket.on('user_typing', onUserTyping);
  socket.on('user_stop_typing', onUserStopTyping);
  socket.on('user_status_changed', onUserStatusChanged);

  // ══════════════════════════════════════════════════════════════
  //  SENDING
  // ══════════════════════════════════════════════════════════════
  function sendMessage(text) {
    if (!text || !text.trim()) return;
    const content = text.trim();

    // Optimistic insert
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

  // ── Input events ──────────────────────────────────────────────
  let lastInputTime = 0;

  messageInput.on('submit', (text) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();

    // Slash commands
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
          messageInput.clearValue();
          messageInput.focus();
          return;
        case '/scroll-top':
          messagesBox.scrollTo(0);
          screen.render();
          messageInput.setValue('');
          return;
        case '/scroll-bottom':
          scrollToBottom();
          screen.render();
          messageInput.setValue('');
          return;
      }
    }

    sendMessage(trimmed);
    messageInput.clearValue();
    messageInput.focus();
    charCounter.setContent('');

    if (isTyping) {
      isTyping = false;
      socket.sendStopTyping(
        isPrivate ? null : targetId,
        user.userId, user.username,
        isPrivate, isPrivate ? targetId : null
      );
    }

    screen.render();
  });

  messageInput.on('keypress', (ch) => {
    const val = messageInput.getValue() || '';
    const len = val.length;

    // Character counter
    if (len > 0) {
      const pct = Math.round((len / MAX_MSG_LEN) * 100);
      const color = len > MAX_MSG_LEN * 0.9 ? 'red-fg' : len > MAX_MSG_LEN * 0.7 ? 'yellow-fg' : 'gray-fg';
      charCounter.setContent(`{${color}}${len}/${MAX_MSG_LEN}{/}`);
    } else {
      charCounter.setContent('');
    }

    // Typing indicator
    const now = Date.now();
    if (now - lastInputTime > 2000) {
      lastInputTime = now;
      if (!isTyping) {
        isTyping = true;
        socket.sendTyping(
          isPrivate ? null : targetId,
          user.userId, user.username,
          isPrivate, isPrivate ? targetId : null
        );
      }
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (isTyping) {
        isTyping = false;
        socket.sendStopTyping(
          isPrivate ? null : targetId,
          user.userId, user.username,
          isPrivate, isPrivate ? targetId : null
        );
      }
    }, 3000);

    screen.render();
  });

  // ── Navigation ────────────────────────────────────────────────
  // NOTE: key handlers must live on `messageInput` — blessed only
  // dispatches key events to the focused element, and the input is
  // always focused here, so bindings on container/messagesBox
  // would never fire.
  backBtn.on('click', () => { cleanup(); onBack(); });
  messageInput.key(['escape'], () => { cleanup(); onBack(); });

  messageInput.key(['pageup'], () => { messagesBox.scrollUp(8); screen.render(); });
  messageInput.key(['pagedown'], () => { messagesBox.scrollDown(8); screen.render(); });
  messageInput.key(['home'], () => { messagesBox.scrollTo(0); screen.render(); });
  messageInput.key(['end'], () => { scrollToBottom(); screen.render(); });

  // Scroll with arrow keys
  messageInput.key(['up'], () => { messagesBox.scrollUp(1); screen.render(); });
  messageInput.key(['down'], () => { messagesBox.scrollDown(1); screen.render(); });

  // ── Load messages ─────────────────────────────────────────────
  async function loadMessages() {
    try {
      if (isPrivate) {
        socket.getPrivateMessages(user.userId, targetId);
      } else {
        socket.getRoomMessages(targetId);
      }
    } catch {
      addSystemMessage('Failed to load messages');
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────
  function cleanup() {
    socket.off('room_messages', onRoomMessages);
    socket.off('private_messages', onPrivateMessages);
    socket.off('room_message', onRoomMessage);
    socket.off('private_message', onPrivateMessage);
    socket.off('user_typing', onUserTyping);
    socket.off('user_stop_typing', onUserStopTyping);
    socket.off('user_status_changed', onUserStatusChanged);

    if (!isPrivate) {
      socket.leaveRoom(targetId, user.userId, user.username);
    } else {
      // Leaving = the web client's X button: state=false in openChats.
      // Everything was marked read during the visit, so the inbox row
      // disappears — until a new message makes it visible again.
      api.closePrivateChat(targetId).catch(() => {});
    }

    if (typingTimeout) clearTimeout(typingTimeout);
  }

  // ── Join + init ───────────────────────────────────────────────
  if (!isPrivate) {
    socket.joinRoom(targetId, user.userId, user.username);
  } else {
    // Opening the chat marks the whole conversation as read
    // (server: messages.updateMany({ receiverId: me, senderId: other }, { $set: { isRead: true } }))
    socket.markChatAsRead(user.userId, targetId);
    // Mark it "open" in the inbox, same as the web client on select
    api.openPrivateChat(targetId).catch(() => {});
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
