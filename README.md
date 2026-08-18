# CLChat

A terminal-based chat client that connects to the Social App backend. Chat in public rooms and private conversations directly from your terminal.

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Or with dev mode (auto-restart on changes):

```bash
npm run dev
```

## Features

- Login / Register with email verification
- Public room chat with unread counts
- Private messaging with online status
- Real-time typing indicators
- User search
- 6 built-in themes (default, matrix, retro, ocean, solarized, dracula)
- Auto-login on restart
- Responsive terminal layout

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

## Commands

Type these in the command input:

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/theme <name>` | Change theme (matrix, retro, ocean, solarized, dracula) |
| `/rooms` | Refresh rooms list |
| `/clear` | Clear chat messages |
| `/back` | Return to lobby |
| `/quit` | Exit |

## Requirements

- Node.js >= 18.0.0
- Terminal with Unicode support

## Data

Session and config are stored in `~/.social-cli/`.

## License

MIT
