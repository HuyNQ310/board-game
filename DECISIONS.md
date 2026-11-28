# Architectural and Technical Decisions

## DEC-001: Initial Project Scaffolding

- **Date**: 2026-11-27
- **Status**: Accepted
- **Context**: Setting up the project skeleton according to `rules.md` section 3 and section 9.
- **Decision**:
  - The repository is set up with Node.js 20+ requirement and npm workspaces (`shared`, `server`, `client`).
  - Native ES modules (`.mjs` for server/shared, `.js`/`.jsx` for client) are used without TypeScript or additional UI frameworks per spec.
  - Development tools are strictly limited to `eslint` (flat config) and `prettier`. No additional libraries have been added.
  - The root `dev` script runs server and client concurrently using shell background execution (`&`) without introducing third-party task runners like `concurrently`.

## DEC-002: Raise max players per room from 6 to 10

- **Date**: 2026-11-27
- **Status**: Accepted (explicit request from project owner)
- **Context**: `rules.md` section 1 (room capacity) and section 4.1/4.2 (deck
  composition) originally fixed the deck at 29 ordinary cards, sized for a
  max of 6 players. Unlimited players is not feasible for a card-counting
  game (the deck must stay finite and every player needs an initial hand
  from it), so the owner approved a concrete ceiling instead.
- **Decision**:
  - `MAX_PLAYERS = 10` (`shared/engine.mjs`, re-exported and used by
    `server/rooms.mjs` for the `ROOM_FULL` check — single source of truth).
  - For n <= 6, the deck is byte-for-byte identical to the original spec
    (29 ordinary cards, same counts) — fully backward compatible.
  - For n > 6, each ordinary card type's count scales by `ceil(base * n / 6)`,
    preserving the original per-type ratio; `cat` is additionally rounded up
    to the nearest even number since it's always played in pairs. `boom`
    (`n-1`) and `defuse` (`2+n`) were already formulaic in the original spec
    and needed no change.
  - Verified live (real server, real sockets): a full 10-player match deals
    correctly (5 cards each) and plays to a real winner. `shared/engine.test.mjs`
    adds a dedicated test asserting correct hand/deck composition for n=7..10.
  - `rules.md` sections 1, 4.2, and 6.2 updated to reflect the new cap and
    the scaling rule.

## DEC-003: Add `lucide-react` for UI Iconography

- **Date**: 2026-11-28
- **Status**: Accepted (explicit request from project owner)
- **Context**: Replacing raw Unicode emojis across buttons, badges, dialogs, and headers with consistent, cross-platform vector icons.
- **Decision**:
  - Installed `lucide-react` in `client/` workspace.
  - Inline SVG flags (`FlagVN` / `FlagUS` in `client/src/components/FlagIcon.jsx`) are used for the `VI` / `EN` language toggle so flags render reliably on Windows as well as macOS/mobile.

## DEC-004: Zero-Hand-Leak 5-Second `nope` Reaction Window

- **Date**: 2026-11-28
- **Status**: Accepted
- **Context**: Previously, `server/handlers.mjs` and `server/index.mjs` checked `engine.hasEligibleNopeHolder(state)` (which inspected `p.hand.includes('nope')`) to decide whether to hold in `phase: 'nope'` or auto-resolve immediately. That leaked to the active player whether any opponent held a `nope` card.
- **Decision**:
  - Added `hasOtherLivingPlayer(state)` in `shared/engine.mjs`, checking only `p.alive && p.id !== state.pendingAction.lastActorId` without inspecting any player's `.hand` (keeping `hasEligibleNopeHolder` exported for backward compatibility).
  - Updated `server/handlers.mjs` (`game:action`, `room:leave`) and `server/index.mjs` (`handlePlayerDisconnect`) to prefer `engine.hasOtherLivingPlayer`, so the 5-second `nope` reaction window always opens whenever at least one other living player exists, resolving early only when all other living players `passNope` or disconnect/are eliminated.
