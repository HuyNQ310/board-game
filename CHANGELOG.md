# Changelog

## Phase 0: pure game engine implementation - 2026-11-27

- Implemented pure immutable game engine in `shared/engine.mjs` adhering strictly to rules.md section 2 and section 4 specifications (pure ES module with zero I/O or DOM dependencies, deterministic RNG injection).
- Exported frozen `CARD` dictionary defining all 8 card types (`boom`, `defuse`, `attack`, `skip`, `shuffle`, `favor`, `peek`, `cat`).
- Exported custom `GameError` subclass with standard machine-readable error codes.
- Implemented `createGame(playerIds, options)` to initialize deck composition and player hands for 2-6 players (1 defuse + 4 ordinary cards dealt to each player, draw pile seeded with remaining ordinary cards, n - 1 exploding kittens, and 2 extra defuses).
- Implemented `applyAction(state, playerId, action)` handling all gameplay actions (`draw`, `defuse`, and card plays for `skip`, `attack`, `shuffle`, `peek`, `favor`, `catPair`).
- Implemented `eliminatePlayer(state, playerId)` to handle player explosions, card discards, and win/draw condition evaluations.
- Implemented `viewFor(state, playerId)` to produce sanitized, secure client-side views (hiding draw deck contents, masking other players' hands with counts only, and restricting private peeks).
- Created unit test suite in `shared/engine.test.mjs` with 30 tests verifying full coverage of section 4 rules, dealing constraints, card behaviors, turn order, elimination, and state sanitization.

## Phase 1 (partial): project scaffolding added - 2026-11-27

- Created root project configuration and workspaces (`shared`, `server`, `client`) in `package.json`.
- Configured ESLint flat config (`eslint.config.js`) for Node ES modules and React JSX.
- Configured Prettier formatting rules (`.prettierrc`).
- Initialized project decision log (`DECISIONS.md`), open questions tracker (`OPEN_QUESTIONS.md`), and changelog (`CHANGELOG.md`).

## Phase 1: server room management and socket event handlers - 2026-11-27

- Implemented room lifecycle and in-memory store in `server/rooms.mjs` supporting unambiguous 5-character room code generation (`createRoomCode`), atomic per-room action queuing via Promise chains (`withRoomQueue`), seat assignment (2 to 6 players), host migration on leave, and inactive room cleanup.
- Implemented player disconnect grace period timers in `server/timers.mjs` (`DisconnectTimers`) enforcing the 120-second timeout before automatic surrender/forfeit.
- Implemented machine-readable error codes and ack helpers in `server/errors.mjs` (`ERROR_CODES`, `toErrorAck`, `mapGameErrorToCode`, `DEV_FALLBACK_MESSAGES`).
- Implemented Socket.IO event handlers and sliding-window rate limiting in `server/handlers.mjs` (`createRateLimiter`, registering `room:create`, `room:join`, `room:leave`, `room:start`, `room:resume`, `game:action`, `room:rematch`, and `disconnect`).
- Bootstrapped Express and Socket.IO server in `server/index.mjs` with `GET /healthz` endpoint returning room metrics, static file hosting from `client/dist` with SPA fallback, and process-level unhandled rejection protection.
- Created comprehensive server unit tests across `server/rooms.test.mjs` (38 tests), `server/handlers.test.mjs` (36 tests), and `server/errors.test.mjs` (17 tests), totaling 91 tests verifying room operations, concurrency serialization, timer expirations, socket flows, and rate limiting.

## Phase 2: Home and Lobby screens with client state - 2026-11-27

- Built `Home` screen in `client/src/screens/Home.jsx` supporting player name input (1-16 characters), room creation, 5-character uppercase join code entry, and auto-resume loading indicator.
- Built `Lobby` screen in `client/src/screens/Lobby.jsx` displaying large room code with clipboard copy and Web Share API buttons, seated player list with host and offline badges, host start game controls (disabled with reason when < 2 players connected), non-host waiting state, and leave room button.
- Implemented client network layer in `client/src/net/socket.js` providing singleton Socket.IO connection, Promise-based `emitWithAck`, and `localStorage` persistence for `playerId` and `roomCode`.
- Implemented client state management in `client/src/state/store.js` using React `useReducer` and Context, featuring version monotonicity guard to ignore stale out-of-order state updates.
- Added internationalization in `client/src/i18n/vi.js`, `en.js`, and `index.js` with Vietnamese translation strings and dynamic action log template formatters.
- Added UI component and state unit tests: `client/src/screens/Home.test.jsx` (19 tests), `client/src/screens/Lobby.test.jsx` (14 tests), `client/src/state/store.test.mjs` (21 tests), and `client/src/i18n/index.test.mjs` (7 tests).

## Phase 3: Game board UI components and App shell integration - 2026-11-27

- Built main game screen in `client/src/screens/Game.jsx` with mobile-first responsive layout (360px up to 1440px) organizing seat ring, draw pile, discard pile, turn indicators, player hand, action bar, action log, and error toasts.
- Built game conclusion screen in `client/src/screens/GameOver.jsx` presenting winner announcement or draw outcome, host rematch button, non-host waiting message, and leave room navigation.
- Created modular gameplay components in `client/src/components/`:
  - `Card.jsx`: Card rendering with dedicated SVG card icons (`icons.jsx`), color tokens, accessibility attributes, and playable/dimmed states.
  - `Hand.jsx`: Horizontal scrollable player hand with keyboard navigation and playable card highlights.
  - `ActionBar.jsx`: Action control bar for drawing cards and playing special cards (`skip`, `attack`, `shuffle`, `peek`, `favor`, `catPair`), dynamically enabled by turn and card requirements.
  - `TargetPicker.jsx`: Modal dialog for selecting an alive opponent target for `favor` or `catPair` actions with cancellation option.
  - `DefuseDialog.jsx`: Non-dismissible bomb placement dialog with insertion position slider (0 to `deckCount`: "Trên cùng" to "Sâu nhất") activated when bomb is drawn.
  - `PeekPanel.jsx`: Private viewer showing the top 3 cards in order, automatically dismissed upon subsequent actions.
  - `SeatRing.jsx`: Circular seat layout showing seat positions, player names, alive/eliminated statuses, offline indicators, and current turn indicator.
  - `DrawPile.jsx`: Draw pile showing remaining deck card count.
  - `DiscardPile.jsx`: Discard pile showing top discarded card and total discard count.
  - `LogPanel.jsx`: Accessible auto-scrolling log panel displaying localized Vietnamese game events.
  - `Toast.jsx`: Polite auto-dismissing (3 seconds) aria-live toast notification for server errors.
- Integrated all screens and socket lifecycle into root application shell in `client/src/App.jsx`, wiring state store, Socket.IO listeners, reconnection handling, eliminated player spectator view, card detail tooltips, and action acknowledgments.
- Added UI component unit tests: `client/src/components/ActionBar.test.jsx` (16 tests), `client/src/components/TargetPicker.test.jsx` (10 tests), `client/src/components/DefuseDialog.test.jsx` (8 tests), and `client/src/components/PeekPanel.test.jsx` (7 tests).

## Status of subsequent phases (Definition of Done criteria) - 2026-11-27

- **Phase 4 (Ổn định / Stability)**: Partially implemented in application code (reconnect banners, spectator mode for eliminated players, rematch flow, room sweep, and client-side pending action guards are wired in `client/src/App.jsx` and server handlers), but formal standalone Phase 4 stability integration tests across all reconnection and timeout scenarios specified in rules.md section 11 remain pending.
- **Phase 5 (Mobile và E2E)**: Not yet done. Playwright is not yet installed or configured in the repository; multi-client E2E automated test scripts (4-player full game playthrough, mid-game disconnect/reconnect) and physical mobile device validation required by rules.md section 11 have not yet been executed.
