# Driftminne

AI-powered operational memory for volunteer organizations. Helps inexperienced volunteers troubleshoot technical issues with the confidence of experienced team members.

## Features

- **AI troubleshooting** — describe a problem, get step-by-step guidance based on your documentation
- **Live streaming responses** — tokens stream in real-time via Kiro CLI (ACP)
- **Markdown knowledge base** — human-editable docs, WYSIWYG editor built in
- **Conversation history** — past incidents stored and searchable
- **Feedback loop** — mark issues as resolved/unresolved, AI suggests doc updates
- **Passkey auth** — passwordless access with admin approval flow
- **Dark mode** — system-aware theming
- **Swedish UI** — built for Swedish volunteer orgs

## Stack

- **Frontend**: React, Vite, TailwindCSS v4, Tiptap editor
- **Backend**: Node.js, Express
- **AI**: Kiro CLI via Agent Client Protocol (ACP)
- **Storage**: Markdown files + JSON database (no external DB needed)
- **Auth**: WebAuthn/Passkeys via SimpleWebAuthn

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your domain

# Copy example database
cp database.example.json database.json

# Start dev server (frontend + backend)
npm run dev
```

Frontend runs on http://localhost:5173, backend on http://localhost:3001.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RP_ID` | WebAuthn relying party ID (your domain) | `localhost` |
| `ORIGIN` | Full origin URL for passkey verification | `http://localhost:5173` |
| `KIRO_PATH` | Path to kiro-cli binary | `~/.local/bin/kiro-cli` |

## Project Structure

```
├── frontend/          React app
├── backend/
│   └── src/
│       ├── index.js          Express server
│       ├── kiro.js           Kiro ACP client
│       ├── auth.js           Passkey authentication
│       └── system_prompt.md  AI system prompt
├── docs/              Markdown knowledge base
├── database.json      Document metadata + incidents
└── settings.json      App configuration
```

## Adding Documentation

Either use the built-in editor (click any doc → Redigera) or create markdown files directly in `docs/` and add entries to `database.json`.

## Production Deployment

```bash
# Build frontend
npm run build -w frontend

# Serve with Express (add static serving) or use a reverse proxy
# Point Caddy/nginx at port 5173 (dev) or build a production setup
```

Recommended: Ubuntu VPS + Docker Compose + Caddy reverse proxy.
