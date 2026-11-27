# Mèo Nổ

**Mèo Nổ** is an original Vietnamese multiplayer card game (explicitly designed from scratch and not a copy of any commercial game, per [rules.md](rules.md) sections 0 and 12). The game is designed for 2 to 6 players in the same room using a 5-character join code, built as a responsive, real-time web application.

## Overview

The repository contains an implementation consisting of a pure, deterministic game engine (`shared/`), a real-time room and game server (`server/` using Express and Socket.IO), and a mobile-first React client (`client/` built with Vite). The engine handles card mechanics, turn and draw resolution, state transitions, private hand masking (`viewFor`), and structured event logging. The server manages room lifecycles, per-room serialized action queues, 120-second disconnection grace period timers, rate limiting, and state synchronization. The client provides interactive screens for Home, Lobby, Game, and Game Over with full Vietnamese localization, accessible controls, and component tests. End-to-end multi-client automated testing and final mobile physical device validation (Phase 5) remain pending.

## How to Play

For the full detailed ruleset and card visual specifications, see [rules.md](rules.md) and [card.md](card.md).

- **Objective & Win Condition**: *Mèo Nổ* is a last-player-standing elimination game. Avoid exploding when drawing cards; the last surviving player wins.
- **The Deck (2–6 players)**:
  - **Bombs (`boom` / Mèo Bùm)**: $n - 1$ cards placed in the draw pile. Drawing a bomb eliminates the player unless they hold a Defuse card.
  - **Defuse (`defuse` / Kìm Cắt Dây)**: Each player starts with 1 Defuse in hand; 2 remaining Defuse cards are shuffled into the draw pile.
  - **Action Cards**: Attack (`attack` / Truy Đuổi), Skip (`skip` / Ngủ Trưa), Shuffle (`shuffle` / Xáo Trộn), Favor (`favor` / Nài Nỉ), Peek (`peek` / Mắt Thần), and Cat (`cat` / Mèo Vằn).
- **Turn Flow**:
  - On your turn, you may play any number of action cards (or none) before ending your turn.
  - You can play Peek to secretly view the top 3 cards of the draw pile, Shuffle to randomize the draw pile, Favor to take a random card from an opponent, or a pair of Cat cards to steal a random card from a chosen player.
  - End your turn by drawing a card from the draw pile (`draw`), or by playing a Skip or Attack card (Attack passes your turn without drawing and forces the next player to take two turns).
- **Bomb & Defuse**:
  - Drawing a bomb without a Defuse card eliminates you from the round (`eliminated`, `reason: bomb`).
  - If you hold a Defuse card, you enter the defuse phase: the Defuse card is discarded, and you secretly reinsert the bomb anywhere into the draw pile at your chosen depth (`insertAt`).

## Tech Stack

The project aligns with the technology stack specified in [rules.md](rules.md) section 3:

| Area | Technology | Details |
| --- | --- | --- |
| **Runtime** | Node.js 20 LTS | Defined in root `package.json` (`"engines": { "node": ">=20" }`) |
| **Modules** | ES Modules (ESM) | Native `.mjs` for `shared/` & `server/`, `.js`/`.jsx` for `client/` |
| **Server** | Express 4.x & Socket.IO 4.x | Express hosts static client assets and `GET /healthz`; Socket.IO handles real-time events |
| **Client** | React 18, React DOM 18, Vite 5, Socket.IO Client 4.x | Mobile-first (360px+), CSS tokens, zero third-party UI libraries |
| **Engine & Server Testing** | `node:test` + `node:assert/strict` | Node built-in test runner; no Jest |
| **Client Testing** | Vitest 2.x + `@testing-library/react` + `jsdom` | Component and unit test runner for React client |
| **E2E Testing** | `@playwright/test` | Multi-player end-to-end integration scenarios (Phase 5) |
| **Linting & Formatting** | ESLint 9 (flat config) + Prettier 3 | Shared repository-wide lint and formatting configurations |

## Project Structure

```text
meo-no/
├── package.json              # Workspaces config (shared, server, client) & root scripts
├── eslint.config.js          # Flat ESLint configuration for Node ESM & React
├── .prettierrc               # Prettier formatting rules
├── rules.md                  # Complete game specification, protocol, and lifecycle rules
├── card.md                   # Card visual specifications, color tokens, and layout guidelines
├── CHANGELOG.md              # Milestone progress and phase records
├── DECISIONS.md              # Architectural Decision Records (ADRs)
├── OPEN_QUESTIONS.md         # Open questions and unresolved requirements tracker
├── shared/                   # Pure deterministic game engine
│   ├── package.json          # Shared package definition
│   ├── engine.mjs            # Game state machine, card definitions, applyAction, viewFor
│   └── engine.test.mjs       # Engine unit tests using node:test
├── server/                   # Room management and WebSocket server
│   ├── package.json          # Server package and dependencies (Express, Socket.IO)
│   ├── index.mjs             # Server entrypoint (Express, Socket.IO, static client hosting)
│   ├── rooms.mjs             # Room model, 5-char code generator, per-room serialized queue
│   ├── handlers.mjs          # Socket event handlers, rate limiting, and client-server protocol
│   ├── timers.mjs            # 120s disconnect timers and cleanup handlers
│   ├── errors.mjs            # Error definitions and error code mappings
│   ├── rooms.test.mjs        # Room lifecycle and concurrency tests
│   ├── handlers.test.mjs     # Socket handler and event flow tests
│   └── errors.test.mjs       # Error mapping tests
└── client/                   # React frontend application
    ├── package.json          # Client dependencies (React, Vite, Vitest)
    ├── index.html            # HTML entry document
    ├── vite.config.js        # Vite config with /socket.io proxy to backend
    ├── vitest.config.js      # Vitest test setup with jsdom
    └── src/
        ├── main.jsx          # React DOM root entrypoint
        ├── App.jsx           # Screen routing, socket event binding, and main UI frame
        ├── screens/          # Primary screens: Home, Lobby, Game, GameOver
        ├── components/       # UI components: Card, Hand, ActionBar, DrawPile, DiscardPile,
        │                     # SeatRing, TargetPicker, DefuseDialog, PeekPanel, LogPanel, Toast
        ├── i18n/             # Localized strings and log templates (vi.js, en.js, index.js)
        ├── net/              # Socket.IO connection wrapper and promise ack helpers (socket.js)
        ├── state/            # React reducer and Context store with version guard (store.js)
        ├── assets/           # Custom SVG card icon definitions (assets/cards/icons.jsx)
        └── styles/           # CSS design tokens, reset, and base styling (base.css)
```

## Prerequisites

- **Node.js**: Version 20.0.0 or higher (`>=20`)
- **npm**: Version 9 or higher (with npm workspaces support)

## Installation

Install all dependencies across the entire repository using npm workspaces:

```bash
npm install
```

This single command installs and links packages for `shared/`, `server/`, and `client/` from the repository root.

## Development & Scripts

All commands are executed from the repository root using scripts configured in `package.json`:

- **`npm run dev`**: Starts the backend server and client Vite development server concurrently in the background (`npm run dev --workspace server & npm run dev --workspace client`). The server runs `node index.mjs` on port 3000, while the client runs `vite` on port 5173 with a development proxy for `/socket.io`.
- **`npm run build`**: Builds the React client for production using `vite build` (`npm run build --workspace client`), outputting bundled assets to `client/dist`.
- **`npm start`**: Runs the production Node server (`npm run start --workspace server`), which serves Socket.IO endpoints, `GET /healthz`, and static files from `client/dist` (default port `PORT` or 3000).
- **`npm test`**: Runs tests across all workspaces where defined (`npm run test --workspaces --if-present`). This runs the `node:test` suites in `shared` (`shared/engine.test.mjs`) and `server` (`server/*.test.mjs`). Client UI tests can be run via `npm run test:ui --workspace client` using Vitest.
- **`npm run lint`**: Lints all source files across the repository using ESLint (`eslint .`).

## Status

Implementation status relative to the milestones defined in [rules.md](rules.md) section 11:

- **Phase 0 — Complete Engine**: **Done**. `shared/engine.mjs` implements all card mechanics, rules, and `viewFor` masking without leaking hidden information, verified by unit tests.
- **Phase 1 — Project Scaffolding & Room Server**: **Done**. Root workspaces configured, `server/` implements room lifecycle, promise-serialized action queues, 120s disconnect timers, rate limits, error mapping, and health checks. *(Note: `CHANGELOG.md` currently records Phase 1 partial scaffolding; full phase changelog updates are pending sync).*
- **Phase 2 — Home & Lobby**: **Done**. Room creation and joining with 5-character codes, seat management, host controls, disconnect tracking, and session resumption implemented with Vitest test coverage.
- **Phase 3 — Game Board & Action UI**: **Done**. Interactive table with player seat ring, hand cards, action bar, defuse dialog, target picker, peek drawer, event logs, and Vietnamese localization (`i18n/vi.js`).
- **Phase 4 — Stability & Reconnection**: **Implemented**. Atomic per-room queue handling, 120s disconnect grace period, session resume (`room:resume`), and reconnect toasts are in place.
- **Phase 5 — Mobile & E2E Testing**: **Pending**. Automated multi-client end-to-end testing with `@playwright/test` and manual verification on physical mobile devices remain to be completed.

## License

TBD
