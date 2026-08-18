# CLI Chat - Development Agents

## Project Overview
**Social CLI** - A terminal-based chat client that connects to the Social App backend. Enables users to participate in public rooms and private conversations directly from the command line.

## Architecture Decision: CLI-Only Client
This project is a **CLI client only** - it connects to the existing Social App backend (`https://social-app-5hge.onrender.com`) via HTTP REST API and Socket.IO WebSocket. No backend code is written or modified.

## Tech Stack
| Component | Technology | Why |
|-----------|-----------|-----|
| CLI UI | `blessed` | Mature TUI framework with responsive layouts, widgets, keyboard/mouse support |
| WebSocket | `socket.io-client` | Matches the server's Socket.IO v4.x for real-time messaging |
| HTTP API | Native `fetch` (Node 18+) | No extra dependency needed, sufficient for REST calls |
| Auth | JWT (access + refresh tokens) | Server-issued tokens stored locally in `~/.social-cli/session.json` |
| Config | `dotenv` + JSON files | Environment config + local user preferences |
| Themes | Custom theme system | 6 built-in themes, switchable via `/theme` command |

## reCAPTCHA Handling
**The server's reCAPTCHA is gracefully skipped for CLI clients.** The backend's `verifyRecaptcha()` function in `authController.js` returns `{ success: true, skipped: true }` when:
- `RECAPTCHA_SECRET_KEY` env var is not set (server-side)
- No `recaptchaToken` is provided in the request body

Our CLI client intentionally does **not** send `recaptchaToken` in register/login requests. This is by design - reCAPTCHA is a browser-based challenge and cannot be solved by a terminal client.

## Backend Endpoints Used

### Authentication (HTTP)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | No | Register new user (username, email, password, age, gender) |
| `/api/auth/login` | POST | Yes (rate limit) | Login with username/email + password |
| `/api/auth/me` | GET | Bearer JWT | Get current user profile |
| `/api/auth/logout` | POST | Bearer JWT | Logout and set offline status |
| `/api/auth/verify-email` | POST | No | Verify email with token |
| `/api/auth/resend-verification` | POST | No | Resend verification email |

### Rooms & Users (HTTP)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/rooms/public` | GET | Bearer JWT | List all public rooms with unread counts |
| `/api/rooms/users` | GET | Bearer JWT | List users (online by default, search with `?search=`) |
| `/api/rooms/user-profile/:userId` | GET | Bearer JWT | Get single user profile |
| `/api/rooms/mark-room-read` | POST | Bearer JWT | Mark room as read (updates lastSeenAt) |
| `/api/rooms/private-chats` | GET | Bearer JWT | List private chats with unread counts |
| `/api/rooms/close-private-chat` | POST | Bearer JWT | Close/hide a private chat |
| `/api/rooms/open-private-chat` | POST | Bearer JWT | Re-open a private chat |

### Settings (HTTP)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/settings/site` | GET | No | Get site-wide settings |

### Socket.IO Events (WebSocket)
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `authenticate` | C→S | `{userId, username}` | Authenticate socket connection |
| `join_room` | C→S | `{roomId, userId, username}` | Join a room |
| `leave_room` | C→S | `{roomId, userId, username}` | Leave a room |
| `send_room_message` | C→S | `{roomId, senderId, senderName, content}` | Send room message |
| `send_private_message` | C→S | `{receiverId, senderId, senderName, content}` | Send private message |
| `get_room_messages` | C→S | `{roomId, limit}` | Request room message history |
| `get_private_messages` | C→S | `{userId, otherUserId, limit}` | Request private message history |
| `typing` | C→S | `{roomId, userId, username, isPrivate, targetId}` | Typing indicator |
| `stop_typing` | C→S | `{roomId, userId, username, isPrivate, targetId}` | Stop typing |
| `mark_as_read` | C→S | `{messageId}` | Mark message as read |
| `mark_chat_as_read` | C→S | `{userId, otherUserId}` | Mark entire chat as read |
| `activity` | C→S | `{}` | Keep-alive heartbeat |
| `user-logout` | C→S | `{reason}` | Broadcast logout to peers |
| `room_message` | S→C | `{messageId, senderId, senderName, content, timestamp}` | Incoming room message |
| `private_message` | S→C | `{messageId, senderId, senderName, content, timestamp}` | Incoming private message |
| `room_messages` | S→C | `{roomId, messages[]}` | Room message history |
| `private_messages` | S→C | `{otherUserId, messages[]}` | Private message history |
| `user_typing` | S→C | `{userId, username}` | Partner typing |
| `user_stop_typing` | S→C | `{userId, username}` | Partner stopped typing |
| `user_status_changed` | S→C | `{userId, status}` | User online/offline status |
| `room_message_notification` | S→C | `{roomId, senderId}` | New message in room |
| `force_logout` | S→C | `{reason}` | Server forces logout (suspension, deletion) |
| `user_joined` | S→C | `{username, userId}` | User joined room |
| `user_left` | S→C | `{username, userId}` | User left room |
| `user-logged-out` | S→C | `{userId, reason}` | User logged out |

## Project Structure
```
clchat/
├── package.json
├── .gitignore
├── agents.md              # This file
├── ARCHITECTURE.md        # Architecture documentation
└── src/
    ├── index.js            # Entry point - screen setup, session restore, navigation
    ├── api/
    │   └── client.js       # HTTP REST API client with JWT auth & token refresh
    ├── socket/
    │   └── client.js       # Socket.IO client wrapper with event system
    ├── screens/
    │   ├── login.js        # Login/Register form with tab switching
    │   ├── lobby.js        # Main menu: rooms list, user list, search, commands
    │   └── chat.js         # Chat view: messages, input, typing indicator
    ├── themes/
    │   └── index.js        # 6 built-in themes (default, matrix, retro, ocean, solarized, dracula)
    └── utils/
        ├── terminal.js     # Terminal size detection, text formatting helpers
        └── storage.js      # Local config & session persistence (~/.social-cli/)
```

## Session Management
- Sessions stored in `~/.social-cli/session.json`
- Contains: accessToken, refreshToken, user object, expiresAt
- Auto-restored on app start (verifies token with `/api/auth/me`)
- Cleared on logout or forced logout

## Theme System
6 themes available, switchable via `/theme <name>`:
- `default` - Dark blue/purple gradient
- `matrix` - Classic green-on-black
- `retro` - Amber terminal
- `ocean` - Blue tones
- `solarized` - Solarized dark
- `dracula` - Dracula color scheme

## Implementation Order
1. ~~Server API analysis (endpoint documentation)~~
2. ~~API client with JWT auth~~
3. ~~Socket.IO client wrapper~~
4. ~~Theme system~~
5. ~~Login/Register screen~~
6. ~~Lobby screen (rooms + users)~~
7. ~~Chat screen (messages + typing)~~
8. ~~Session persistence~~
9. Testing and bug fixes
