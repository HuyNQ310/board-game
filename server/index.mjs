import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

import * as roomsModule from './rooms.mjs';
import * as errorsModule from './errors.mjs';
import * as engineModule from '../shared/engine.mjs';
import * as handlersModule from './handlers.mjs';

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

  if (room.game && typeof engine.viewFor === 'function') {
    for (const player of room.players || []) {
      try {
        const view = engine.viewFor(room.game, player.id);
        io.to(player.id).emit('game:state', { ...view, version: room.game.version });
      } catch (err) {
        console.error('broadcastState: viewFor failed for player', player.id, err);
      }
    }
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

// Wire Socket.IO event handlers on connection
io.on('connection', (socket) => {
  if (handlers && typeof handlers === 'object') {
    for (const [eventName, handler] of Object.entries(handlers)) {
      if (typeof handler === 'function') {
        socket.on(eventName, (payload, ack) => handler(socket, payload, ack));
      }
    }
  }
});

// Health check endpoint (rules.md section 7.5)
app.get('/healthz', (req, res) => {
  res.json({ ok: true, rooms: getRoomCount(roomStore) });
});

// Static assets from client/dist and SPA fallback
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

app.use(express.static(CLIENT_DIST));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) {
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

export { app, server, io, roomStore };
export default server;
