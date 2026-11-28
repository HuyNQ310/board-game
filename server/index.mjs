import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

import * as roomsModule from './rooms.mjs';
import * as errorsModule from './errors.mjs';
import * as engineModule from '../shared/engine.mjs';
import * as handlersModule from './handlers.mjs';
import { DisconnectTimers } from './timers.mjs';
import { createRateLimiter } from './handlers.mjs';
import {
  ensureVoiceStates,
  toVoicePeersPayload,
  setPlayerVoiceState,
  clearPlayerVoiceState,
  validateVoiceSignal,
} from './voice.mjs';
import { createDatabase } from './db.mjs';
import { createAuthRouter, parseCookies, SESSION_COOKIE_NAME } from './authRoutes.mjs';
import { createSeoRouter } from './seo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB_PATH = path.resolve(__dirname, '../data/meo-no.sqlite');
const db = createDatabase(process.env.DB_PATH || DEFAULT_DB_PATH);

// ============================================================================
// RoomStore Defensive Adapter
// Adapts whichever shape server/rooms.mjs exports (RoomStore class,
// createRoomStore factory, or default export) and provides room count helper.
// ============================================================================
function createRoomStoreInstance() {
  const Target =
    roomsModule.RoomStore ||
    roomsModule.createRoomStore ||
    roomsModule.default;

  if (typeof Target === 'function') {
    try {
      return new Target();
    } catch (err) {
      if (err instanceof TypeError && !/class constructor/i.test(err.message)) {
        return Target();
      }
      throw err;
    }
  }
  return Target || {};
}

const roomStore = createRoomStoreInstance();

function getRoomCount(store) {
  if (!store) return 0;
  if (typeof store.getRoomCount === 'function') {
    return store.getRoomCount();
  }
  if (typeof store.listRooms === 'function') {
    const list = store.listRooms();
    if (Array.isArray(list)) return list.length;
    if (list && typeof list.size === 'number') return list.size;
    if (list && typeof list === 'object') return Object.keys(list).length;
  }
  if (store.rooms) {
    if (typeof store.rooms.size === 'number') return store.rooms.size;
    if (Array.isArray(store.rooms)) return store.rooms.length;
    if (typeof store.rooms === 'number') return store.rooms;
    if (typeof store.rooms === 'object') return Object.keys(store.rooms).length;
  }
  if (typeof store.count === 'function') {
    return store.count();
  }
  if (typeof store.size === 'number') {
    return store.size;
  }
  if (typeof store.count === 'number') {
    return store.count;
  }
  return 0;
}
// ============================================================================

// Error mapping helpers
const mapGameErrorToCode =
  errorsModule.mapGameErrorToCode ||
  errorsModule.default?.mapGameErrorToCode ||
  ((err) => (err?.code ? err.code : 'INVALID_ACTION'));

const toErrorAck =
  errorsModule.toErrorAck ||
  errorsModule.default?.toErrorAck ||
  ((code, message) => ({ ok: false, code, message: message || '' }));

// Engine methods
const engine = {
  createGame: engineModule.createGame || engineModule.default?.createGame,
  applyAction: engineModule.applyAction || engineModule.default?.applyAction,
  eliminatePlayer: engineModule.eliminatePlayer || engineModule.default?.eliminatePlayer,
  viewFor: engineModule.viewFor || engineModule.default?.viewFor,
  hasOtherLivingPlayer: engineModule.hasOtherLivingPlayer || engineModule.default?.hasOtherLivingPlayer,
  hasEligibleNopeHolder: engineModule.hasEligibleNopeHolder || engineModule.default?.hasEligibleNopeHolder,
  resolvePendingAction: engineModule.resolvePendingAction || engineModule.default?.resolvePendingAction,
  ...engineModule,
};

// Handlers creation
const createHandlers =
  handlersModule.createHandlers ||
  handlersModule.default?.createHandlers ||
  handlersModule.default;

// Express app and HTTP server setup
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ============================================================================
// broadcastState: per rules.md section 6.4/6.5/6.6.
// `room:state` goes to everyone in the room (public lobby/seat info).
// `game:state` is PER-PLAYER PRIVATE (viewFor() hides other hands/deck/peek),
// sent only to that player's own private channel. Each socket also joins a
// room named after its own playerId (see server/handlers.mjs) so a player
// can be targeted here even across reconnects/multiple tabs.
// ============================================================================
function buildRoomStatePayload(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: (room.players || []).map((p, i) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      seat: i,
    })),
  };
}

async function broadcastState(room) {
  if (!room || !room.code) return;
  io.to(room.code).emit('room:state', buildRoomStatePayload(room));

  if (room.voiceStates instanceof Map && room.voiceStates.size > 0) {
    const playersById = new Map(
      (room.players || []).filter((p) => p?.id).map((p) => [p.id, p])
    );
    for (const [pid, state] of Array.from(room.voiceStates.entries())) {
      const player = playersById.get(pid);
      if (!player) {
        clearPlayerVoiceState(room, pid);
      } else if (!player.connected && (state?.micOn || state?.speaking)) {
        setPlayerVoiceState(room, pid, { micOn: false, speaking: false });
      }
    }
    io.to(room.code).emit('voice:peers', { peers: toVoicePeersPayload(room) });
  }

  if (room.game && typeof engine.viewFor === 'function') {
    if (
      (room.status === 'finished' || room.game.phase === 'over') &&
      room._recordedMatchVersion !== room.game.version
    ) {
      room._recordedMatchVersion = room.game.version;
      try {
        const bindings = room.userBindings instanceof Map ? room.userBindings : new Map();
        const participantUserIds = (room.players || [])
          .map((p) => (p?.id ? bindings.get(p.id) : null))
          .filter(Boolean);
        const winnerId = room.game.winnerId ?? null;
        const winnerPlayer = winnerId
          ? (room.players || []).find((p) => p?.id === winnerId)
          : null;
        const winnerUserId = winnerId ? bindings.get(winnerId) || null : null;
        db.recordMatchResult({
          roomCode: room.code,
          participantUserIds,
          winnerUserId,
          winnerName: winnerPlayer?.name || '',
          playerCount: (room.players || []).length,
        });
      } catch (err) {
        console.error('recordMatchResult error:', err);
      }
    }

    const turnDeadline = scheduleTurnTimer(room);
    const serverNow = Date.now();
    for (const player of room.players || []) {
      try {
        const view = engine.viewFor(room.game, player.id);
        io.to(player.id).emit('game:state', {
          ...view,
          version: room.game.version,
          turnDeadline,
          serverNow,
        });
      } catch (err) {
        console.error('broadcastState: viewFor failed for player', player.id, err);
      }
    }
  } else {
    room._turnTimerState = null;
    turnTimers.cancel(room.code);
  }
}

const handlers =
  typeof createHandlers === 'function'
    ? createHandlers({
        roomStore,
        mapGameErrorToCode,
        toErrorAck,
        engine,
        rng: Math.random,
        broadcastState,
        io,
      })
    : {};

// ============================================================================
// Disconnect handling (rules.md section 5.4, D7, D8).
// `server/timers.mjs` (DisconnectTimers) is fully unit-tested but was never
// wired to a real socket event anywhere -- this is that wiring. On a real
// socket disconnect, mark the player offline immediately, broadcast it, and
// start a 120s grace timer. If the player reconnects (room:resume succeeds)
// before it fires, the timer is cancelled. If it fires: lobby/finished ->
// remove the player entirely (D7); playing -> eliminate via the engine (D8),
// which also advances the turn if it was theirs.
// ============================================================================
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 120000;
const disconnectTimers = new DisconnectTimers();

function disconnectKey(code, playerId) {
  return `${code}:${playerId}`;
}

function markPlayerConnected(room, playerId, connected) {
  const player = room?.players?.find((p) => p.id === playerId);
  if (player) player.connected = connected;
  return player;
}

async function handlePlayerDisconnect(code, playerId) {
  const room = roomStore.getRoom?.(code);
  if (!room) return;
  markPlayerConnected(room, playerId, false);
  setPlayerVoiceState(room, playerId, { micOn: false, speaking: false });
  await broadcastState(room);

  disconnectTimers.start(
    disconnectKey(code, playerId),
    async () => {
      const current = roomStore.getRoom?.(code);
      if (!current) return;
      const player = current.players?.find((p) => p.id === playerId);
      // Reconnected before the grace period ended -- nothing to do.
      if (!player || player.connected) return;

      try {
        if (current.status === 'playing' && current.game && typeof engine.eliminatePlayer === 'function') {
          current.game = engine.eliminatePlayer(current.game, playerId, 'disconnect', Math.random);
          const hasPossibleRespondent =
            typeof engine.hasOtherLivingPlayer === 'function'
              ? engine.hasOtherLivingPlayer(current.game)
              : (typeof engine.hasEligibleNopeHolder === 'function'
                  ? engine.hasEligibleNopeHolder(current.game)
                  : true);
          if (
            current.game?.phase === 'nope' &&
            !hasPossibleRespondent &&
            typeof engine.resolvePendingAction === 'function'
          ) {
            current.game = await engine.resolvePendingAction(current.game, Math.random);
          }
          if (
            current.game?.phase === 'over' ||
            (current.game?.winnerId !== undefined && current.game?.winnerId !== null)
          ) {
            current.status = 'finished';
          }
        } else {
          roomStore.leaveRoom?.(code, playerId);
        }
      } catch (err) {
        console.error('disconnect grace period expiry error:', err);
      }
      await broadcastState(current);
    },
    DISCONNECT_GRACE_MS
  );
}

// ============================================================================
// Turn timer (rules.md D3, changed from the original v1 "no timer" decision
// per explicit owner request): each turn gets 30 seconds. If the current
// player hasn't acted by then, the server acts on their behalf -- `defuse`
// (inserted at the middle of the draw pile) if they're stuck in the defuse
// phase, otherwise a plain `draw`. The timer is rescheduled every time
// broadcastState() runs with an active game, which happens after every
// successful action AND after disconnect-driven eliminations, so it always
// tracks whoever is actually current. One timer per room (keyed by room
// code); `game:state.turnDeadline` (epoch ms) lets each client render its
// own countdown without depending on network latency.
// ============================================================================
const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS) || 30000;
const NOPE_WINDOW_MS = Number(process.env.NOPE_WINDOW_MS) || 5000;
const turnTimers = new DisconnectTimers();

// Separate rate limiter instance for chat (D12's 10/s applies per-socket per
// concern; chat shouldn't share a budget with game actions or vice versa).
const chatRateLimiter = createRateLimiter();
const voiceRateLimiter = createRateLimiter({ max: 60, windowMs: 1000 });

function scheduleTurnTimer(room) {
  if (!room?.game || room.game.phase === 'over' || !room.game.currentPlayerId) {
    if (room) room._turnTimerState = null;
    if (room?.code) turnTimers.cancel(room.code);
    return null;
  }

  const expectedVersion = room.game.version;

  if (room.game.phase === 'nope') {
    const expectedNopeCount = room.game.pendingAction?.nopeCount ?? 0;
    const timerKey = `nope:${expectedVersion}:${expectedNopeCount}`;

    if (
      turnTimers.has(room.code) &&
      room._turnTimerState?.key === timerKey &&
      typeof room._turnTimerState.deadline === 'number' &&
      room._turnTimerState.deadline > Date.now()
    ) {
      return room._turnTimerState.deadline;
    }

    const deadline = Date.now() + NOPE_WINDOW_MS;
    room._turnTimerState = { key: timerKey, deadline };

    turnTimers.start(
      room.code,
      async () => {
        const runResolve = async () => {
          const current = roomStore.getRoom?.(room.code);
          if (!current?.game || current.game.phase === 'over') return;
          if (
            current.game.phase !== 'nope' ||
            current.game.version !== expectedVersion ||
            (current.game.pendingAction?.nopeCount ?? 0) !== expectedNopeCount
          ) {
            return;
          }

          try {
            if (typeof engine.resolvePendingAction === 'function') {
              current.game = await engine.resolvePendingAction(current.game, Math.random);
            } else {
              current.game = await engine.applyAction(
                current.game,
                current.game.currentPlayerId,
                { type: 'resolveNope' },
                Math.random
              );
            }
            if (
              current.game.phase === 'over' ||
              (current.game.winnerId !== undefined && current.game.winnerId !== null)
            ) {
              current.status = 'finished';
            }
          } catch (err) {
            console.error('nope window timer resolve error:', err);
          }
          await broadcastState(current);
        };

        if (typeof room.enqueue === 'function') {
          await room.enqueue(runResolve);
        } else {
          await runResolve();
        }
      },
      NOPE_WINDOW_MS
    );

    return deadline;
  }

  const expectedPlayerId = room.game.currentPlayerId;
  const expectedPendingDefuseId = room.game.pendingDefuseId ?? null;
  const timerKey = `turn:${expectedVersion}:${room.game.phase}:${expectedPlayerId}:${expectedPendingDefuseId ?? ''}`;

  // Preserve the active turn deadline across non-game-mutating broadcasts
  // (e.g. a peer disconnecting or resuming) so clients don't hit 0s early
  // while the server silently resets the turn timer without bumping version.
  if (
    turnTimers.has(room.code) &&
    room._turnTimerState?.key === timerKey &&
    typeof room._turnTimerState.deadline === 'number' &&
    room._turnTimerState.deadline > Date.now()
  ) {
    return room._turnTimerState.deadline;
  }

  const deadline = Date.now() + TURN_TIMEOUT_MS;
  room._turnTimerState = { key: timerKey, deadline };

  turnTimers.start(
    room.code,
    async () => {
      const runAutoTurn = async () => {
        const current = roomStore.getRoom?.(room.code);
        if (!current?.game || current.game.phase === 'over') return;
        // Only act if nothing has changed since we scheduled this timer --
        // a real action or a disconnect-elimination already rescheduled a
        // fresh timer for whatever is current now, so this one is stale.
        if (
          current.game.phase === 'nope' ||
          current.game.version !== expectedVersion ||
          current.game.currentPlayerId !== expectedPlayerId ||
          (current.game.pendingDefuseId ?? null) !== expectedPendingDefuseId
        ) {
          return;
        }

        try {
          if (current.game.phase === 'defuse' && current.game.pendingDefuseId === expectedPlayerId) {
            const insertAt = Math.floor((current.game.deckCount ?? current.game.deck?.length ?? 0) / 2);
            current.game = engine.applyAction(current.game, expectedPlayerId, { type: 'defuse', insertAt }, Math.random);
          } else {
            current.game = engine.applyAction(current.game, expectedPlayerId, { type: 'draw' }, Math.random);
          }
          if (current.game.winnerId !== undefined && current.game.winnerId !== null) {
            current.status = 'finished';
          }
        } catch (err) {
          console.error('turn timer auto-action error:', err);
        }
        await broadcastState(current);
      };

      if (typeof room.enqueue === 'function') {
        await room.enqueue(runAutoTurn);
      } else {
        await runAutoTurn();
      }
    },
    TURN_TIMEOUT_MS
  );

  return deadline;
}

// Wire Socket.IO event handlers on connection
io.on('connection', (socket) => {
  const resolveSocketUserId = (explicitToken) => {
    try {
      const cookies = parseCookies(socket.handshake?.headers?.cookie);
      const token =
        explicitToken ||
        socket.handshake?.auth?.token ||
        cookies[SESSION_COOKIE_NAME] ||
        null;
      const user = token ? db.getUserByToken(token) : null;
      return user?.id || null;
    } catch {
      return null;
    }
  };

  socket.data.userId = resolveSocketUserId();

  const bindPlayerToUserIfLoggedIn = () => {
    const userId = socket.data?.userId;
    const playerId = socket.data?.playerId ?? socket.playerId;
    const code = socket.data?.roomCode ?? socket.roomCode;
    if (!userId || !playerId || !code) return;
    const room = roomStore.getRoom?.(code);
    if (!room) return;
    if (!(room.userBindings instanceof Map)) {
      room.userBindings = new Map();
    }
    room.userBindings.set(playerId, userId);
  };

  socket.on('auth:sync', (payload, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {};
    socket.data.userId = resolveSocketUserId(payload?.token || null);
    bindPlayerToUserIfLoggedIn();
    safeAck({ ok: true, userId: socket.data.userId });
  });

  if (handlers && typeof handlers === 'object') {
    for (const [eventName, handler] of Object.entries(handlers)) {
      if (typeof handler !== 'function') continue;

      if (eventName === 'room:resume') {
        // Cancel any pending disconnect timer once a resume actually succeeds.
        socket.on(eventName, (payload, ack) => {
          const wrappedAck = (res) => {
            if (res && res.ok) {
              const playerId = payload?.playerId;
              const code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : null;
              if (playerId && code) disconnectTimers.cancel(disconnectKey(code, playerId));
              bindPlayerToUserIfLoggedIn();
            }
            if (typeof ack === 'function') ack(res);
          };
          handler(socket, payload, wrappedAck);
        });
      } else if (eventName === 'room:create' || eventName === 'room:join') {
        socket.on(eventName, (payload, ack) => {
          const wrappedAck = (res) => {
            if (res && res.ok) {
              bindPlayerToUserIfLoggedIn();
            }
            if (typeof ack === 'function') ack(res);
          };
          handler(socket, payload, wrappedAck);
        });
      } else {
        socket.on(eventName, (payload, ack) => handler(socket, payload, ack));
      }
    }
  }

  socket.on('disconnect', () => {
    const playerId = socket.data?.playerId ?? socket.playerId;
    const code = socket.data?.roomCode ?? socket.roomCode;
    if (!playerId || !code) return;
    handlePlayerDisconnect(code, playerId).catch((err) => {
      console.error('handlePlayerDisconnect error:', err);
    });
  });

  // ==========================================================================
  // Real-time chat (owner-requested, section 0's original v1 scope explicitly
  // excluded chat -- changed per direct request, same pattern as the turn
  // timer above). Ephemeral only: relayed to the room, not persisted, no
  // history sent to new joiners (keeps this consistent with "lưu lịch sử dài
  // hạn" staying out of scope). Rate-limited with the same per-socket sliding
  // window handlers.mjs already uses for game events, so chat spam can't
  // starve real game actions or vice versa (separate limiter instance).
  // ==========================================================================
  socket.on('chat:message', (payload, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {};
    if (!chatRateLimiter.consume(socket.id)) {
      safeAck({ ok: false, code: 'RATE_LIMIT', message: 'Thao tác quá nhanh, thử lại sau chút' });
      return;
    }

    const playerId = socket.data?.playerId ?? socket.playerId;
    const code = socket.data?.roomCode ?? socket.roomCode;
    const rawText = payload?.text;

    if (!playerId || !code) {
      safeAck({ ok: false, code: 'NOT_IN_ROOM', message: 'Bạn không còn trong phòng này' });
      return;
    }
    if (typeof rawText !== 'string' || !rawText.trim()) {
      safeAck({ ok: false, code: 'INVALID_ACTION', message: 'Tin nhắn không hợp lệ' });
      return;
    }
    const text = rawText.trim().slice(0, 500);

    const room = roomStore.getRoom?.(code);
    const player = room?.players?.find((p) => p.id === playerId);
    if (!room || !player) {
      safeAck({ ok: false, code: 'NOT_IN_ROOM', message: 'Bạn không còn trong phòng này' });
      return;
    }

    io.to(code).emit('chat:message', {
      playerId,
      name: player.name,
      text,
      at: Date.now(),
    });
    safeAck({ ok: true });
  });

  // ==========================================================================
  // WebRTC voice signaling & room voice presence
  // ==========================================================================
  const resolveVoiceRoomMember = () => {
    const playerId = socket.data?.playerId ?? socket.playerId;
    const code = socket.data?.roomCode ?? socket.roomCode;
    if (!playerId || !code) return null;
    const room = roomStore.getRoom?.(code);
    const player = room?.players?.find((p) => p.id === playerId);
    if (!room || !player) return null;
    return { playerId, code, room };
  };

  socket.on('voice:sync', (payload, ack) => {
    const safeAck =
      typeof ack === 'function' ? ack : typeof payload === 'function' ? payload : () => {};
    const ctx = resolveVoiceRoomMember();
    if (!ctx) {
      safeAck(toErrorAck('NOT_IN_ROOM'));
      return;
    }
    ensureVoiceStates(ctx.room);
    safeAck({ ok: true, peers: toVoicePeersPayload(ctx.room) });
  });

  socket.on('voice:status', (payload, ack) => {
    const safeAck =
      typeof ack === 'function' ? ack : typeof payload === 'function' ? payload : () => {};
    if (!voiceRateLimiter.consume(socket.id)) {
      safeAck(toErrorAck('RATE_LIMIT'));
      return;
    }
    const ctx = resolveVoiceRoomMember();
    if (!ctx) {
      safeAck(toErrorAck('NOT_IN_ROOM'));
      return;
    }
    const peers = setPlayerVoiceState(
      ctx.room,
      ctx.playerId,
      payload && typeof payload === 'object' ? payload : {}
    );
    if (!peers) {
      safeAck(toErrorAck('NOT_IN_ROOM'));
      return;
    }
    io.to(ctx.code).emit('voice:peers', { peers });
    safeAck({ ok: true, peers });
  });

  socket.on('voice:signal', (payload, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {};
    if (!voiceRateLimiter.consume(socket.id)) {
      safeAck(toErrorAck('RATE_LIMIT'));
      return;
    }
    const ctx = resolveVoiceRoomMember();
    if (!ctx) {
      safeAck(toErrorAck('NOT_IN_ROOM'));
      return;
    }
    const validated = validateVoiceSignal(ctx.room, ctx.playerId, payload);
    if (!validated) {
      safeAck(toErrorAck('INVALID_ACTION'));
      return;
    }
    io.to(validated.to).emit('voice:signal', {
      from: ctx.playerId,
      type: validated.type,
      description: validated.description,
      candidate: validated.candidate,
    });
    safeAck({ ok: true });
  });
});

// ============================================================================
// Periodic stale-room cleanup (rules.md section 7.4 / D13): every 60s, remove
// rooms with zero connections whose lastActiveAt is older than 10 minutes.
// ============================================================================
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000;
if (typeof roomStore.cleanupStaleRooms === 'function') {
  setInterval(() => {
    try {
      roomStore.cleanupStaleRooms(Date.now());
    } catch (err) {
      console.error('cleanupStaleRooms error:', err);
    }
  }, ROOM_CLEANUP_INTERVAL_MS).unref();
}

// Health check endpoint (rules.md section 7.5)
app.get('/healthz', (req, res) => {
  res.json({ ok: true, rooms: getRoomCount(roomStore), db: 'ok' });
});

// Auth, profile preferences, leaderboard API & SEO/GEO routes
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
const CLIENT_PUBLIC = path.resolve(__dirname, '../client/public');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

app.use(createAuthRouter({ db }));
app.use(createSeoRouter({ clientDistDir: CLIENT_DIST, clientPublicDir: CLIENT_PUBLIC }));

// Static assets from client/dist and SPA fallback
app.use(express.static(CLIENT_DIST));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io') || req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(INDEX_HTML, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(404).send('Client build not found');
      }
    }
  });
});

// Port and server listener (rules.md section 1 D15)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Unhandled promise rejections (rules.md section 10)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { app, server, io, roomStore, db };
export default server;
