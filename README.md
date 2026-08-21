# CLChat

A terminal-based chat client that connects to the Social App backend. Chat in public rooms and private conversations directly from your terminal.

**Web App:** [netcify.netlify.app](https://netcify.netlify.app/)

## Download

### Standalone (no Node.js required)

**[Download clchat.exe](https://github.com/eaeoz/clchat/releases/download/1.0.9/clchat.exe)**

Just run it from anywhere.

### Install globally via npm

```bash
npm install -g clchat
clchat
```

After a single install, run `clchat` from any directory.

## Features

- **Register & Login** — create an account with username, email, password, age, and gender. Email verification supported.
- **Public Rooms** — browse available rooms, see unread message counts, join conversations.
- **Private Messaging** — send direct messages to any user with online/offline status indicators.
- **Real-time Chat** — messages delivered instantly via WebSocket.
- **Typing Indicators** — see when someone is typing a reply.
- **User Search** — find users by username.
- **Session Persistence** — auto-login on restart, no need to re-enter credentials.
- **6 Themes** — default, matrix, retro, ocean, solarized, dracula. Switch with `/theme <name>`.
- **Responsive Layout** — adapts to your terminal size.

## Install (from source)

```bash
npm install
npm start
```

Dev mode (auto-restart on changes):

```bash
npm run dev
```

## Build Executable

```bash
npm run build:exe
```

Produces `dist/clchat.exe` — a single portable file.

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/theme <name>` | Change theme (matrix, retro, ocean, solarized, dracula) |
| `/rooms` | Refresh rooms list |
| `/clear` | Clear chat messages |
| `/back` | Return to lobby |
| `/quit` | Exit |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Switch between panels |
| Enter | Select / Send message |
| Escape | Go back to lobby |
| PageUp / PageDown | Scroll messages |
| F1 | Show help |
| F5 | Refresh rooms |
| Ctrl+C | Exit |

## Requirements

- Node.js >= 18.0.0 (not required for the standalone exe)
- Terminal with Unicode support

## Data

Session and config are stored in `~/.social-cli/`.

## License

MIT
