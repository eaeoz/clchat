import { io } from 'socket.io-client';

const SERVER_URL = process.env.API_URL || 'https://social-app-5hge.onrender.com';

class SocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connected = false;
    this.userId = null;
    this.username = null;
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.emit('connected');
      if (this.userId) this.authenticate(this.userId, this.username);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.emit('error', `Connection error: ${error.message}`);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.emit('reconnecting', attempt);
    });

    this.socket.on('reconnect', () => {
      this.emit('reconnected');
      if (this.userId) this.authenticate(this.userId, this.username);
    });

    this.socket.on('force_logout', (data) => {
      this.emit('force_logout', data);
    });

    this.socket.on('error', (data) => {
      this.emit('server_error', data);
    });

    this.socket.on('user_status_changed', (data) => {
      this.emit('user_status_changed', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      this.emit('user_stop_typing', data);
    });

    this.socket.on('room_message', (data) => {
      this.emit('room_message', data);
    });

    this.socket.on('room_message_notification', (data) => {
      this.emit('room_message_notification', data);
    });

    this.socket.on('private_message', (data) => {
      this.emit('private_message', data);
    });

    this.socket.on('room_messages', (data) => {
      this.emit('room_messages', data);
    });

    this.socket.on('private_messages', (data) => {
      this.emit('private_messages', data);
    });

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data);
    });

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data);
    });

    this.socket.on('user-logged-out', (data) => {
      this.emit('user-logged-out', data);
    });
  }

  authenticate(userId, username) {
    this.userId = userId;
    this.username = username;
    if (this.socket?.connected) {
      this.socket.emit('authenticate', { userId, username });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      // Clear identity so a later reconnect can't auto-authenticate
      // as the previous user (e.g. after logout / account switch).
      this.userId = null;
      this.username = null;
    }
  }

  // Room events
  joinRoom(roomId, userId, username) {
    this.socket?.emit('join_room', { roomId, userId, username });
  }

  leaveRoom(roomId, userId, username) {
    this.socket?.emit('leave_room', { roomId, userId, username });
  }

  sendRoomMessage(roomId, senderId, senderName, content, messageType = 'text') {
    this.socket?.emit('send_room_message', { roomId, senderId, senderName, content, messageType });
  }

  getRoomMessages(roomId, limit = 50) {
    this.socket?.emit('get_room_messages', { roomId, limit });
  }

  // Private message events
  sendPrivateMessage(receiverId, senderId, senderName, content, messageType = 'text') {
    this.socket?.emit('send_private_message', { receiverId, senderId, senderName, content, messageType });
  }

  getPrivateMessages(userId, otherUserId, limit = 50) {
    this.socket?.emit('get_private_messages', { userId, otherUserId, limit });
  }

  // Typing events
  sendTyping(roomId, userId, username, isPrivate = false, targetId = null) {
    this.socket?.emit('typing', { roomId, userId, username, isPrivate, targetId });
  }

  sendStopTyping(roomId, userId, username, isPrivate = false, targetId = null) {
    this.socket?.emit('stop_typing', { roomId, userId, username, isPrivate, targetId });
  }

  // Read receipts
  markAsRead(messageId) {
    this.socket?.emit('mark_as_read', { messageId });
  }

  markChatAsRead(userId, otherUserId) {
    this.socket?.emit('mark_chat_as_read', { userId, otherUserId });
  }

  // Activity heartbeat
  sendActivity() {
    this.socket?.emit('activity');
  }

  // User logout
  sendLogout(reason = 'user_logout') {
    this.socket?.emit('user-logout', { reason });
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Event handler error [${event}]:`, err);
        }
      }
    }
  }
}

export default new SocketClient();
