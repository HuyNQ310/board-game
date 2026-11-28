/**
 * @file server/integration.test.mjs
 * Real end-to-end integration tests wiring together:
 * - shared/engine.mjs (real engine, no mocks)
 * - server/rooms.mjs (RoomStore)
 * - server/handlers.mjs (createHandlers)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { io as createIoClient } from 'socket.io-client';
import * as engine from '../shared/engine.mjs';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
import { RoomStore, toRoomState } from './rooms.mjs';
import { createHandlers } from './handlers.mjs';

const { CARD } = engine;

/**
 * Deterministic RNG helper for reproducible tests.
 */
function createSeededRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Creates a minimal socket stub compatible with createHandlers.
 */
function createSocketStub(id) {
  const emitted = [];
  const joined = new Set();
  return {
    id,
    data: {},
    emitted,
    joined,
    join(room) {
      joined.add(room);
    },
    leave(room) {
      joined.delete(room);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

/**
 * Invokes a socket handler and resolves with its ack payload.
 */
function emitWithAck(handler, socket, payload) {
  return new Promise(resolve => {
    handler(socket, payload, res => resolve(res));
  });
}

/**
 * Wires RoomStore + createHandlers + real shared/engine together and captures broadcasts.
 */
function createTestHarness(seed = 42) {
  const rng = createSeededRng(seed);
  const roomStore = new RoomStore({ rng });
  const broadcasts = [];

  const handlers = createHandlers({
    roomStore,
    engine,
    rng,
    broadcastState: room => {
      const views = {};
      if (room.game) {
        for (const p of room.players) {
          views[p.id] = engine.viewFor(room.game, p.id);
        }
      }
      broadcasts.push({
        room: toRoomState(room),
        views,
      });
    },
  });

  return { roomStore, handlers, broadcasts };
}

test('Integration 1: 4 players create/join and start game -> 51 cards, 5 per hand (1 defuse + 4 ordinary), direction === 1', async () => {
  const { roomStore, handlers, broadcasts } = createTestHarness(101);
  const sockets = {
    p1: createSocketStub('sock-1'),
    p2: createSocketStub('sock-2'),
    p3: createSocketStub('sock-3'),
    p4: createSocketStub('sock-4'),
  };

  const createRes = await emitWithAck(handlers['room:create'], sockets.p1, {
    playerId: 'p1',
    name: 'An',
  });
  assert.equal(createRes.ok, true);
  const code = createRes.code;

  for (const [id, name] of [
    ['p2', 'Bình'],
    ['p3', 'Chi'],
    ['p4', 'Dũng'],
  ]) {
    const joinRes = await emitWithAck(handlers['room:join'], sockets[id], {
      code,
      playerId: id,
      name,
    });
    assert.equal(joinRes.ok, true);
  }

  const startRes = await emitWithAck(handlers['game:start'], sockets.p1, {});
  assert.equal(startRes.ok, true);

  const room = roomStore.getRoom(code);
  assert.equal(room.status, 'playing');
  assert.ok(room.game);
  assert.equal(room.game.direction, 1);

  // Verify 4 players each have 5 cards: 1 defuse + 4 ordinary (no boom)
  for (const p of room.game.players) {
    assert.equal(p.hand.length, 5);
    assert.equal(p.hand.filter(c => c === CARD.defuse).length, 1);
    assert.equal(p.hand.filter(c => c === CARD.boom).length, 0);
  }

  // Verify total cards = 43 + 2 * 4 = 51
  const totalCards =
    room.game.deck.length +
    room.game.players.reduce((sum, p) => sum + p.hand.length, 0);
  assert.equal(totalCards, 43 + 2 * 4);
  assert.equal(totalCards, 51);

  // Verify broadcasted views include direction === 1
  const latestBroadcast = broadcasts[broadcasts.length - 1];
  assert.equal(latestBroadcast.views.p1.direction, 1);
  assert.equal(latestBroadcast.views.p2.players.find(p => p.id === 'p1').hand, undefined);
});

test('Integration 2: reverse card auto-resolves when no opponent holds nope, flips direction to -1, moves turn p1 -> p3', async () => {
  const { roomStore, handlers, broadcasts } = createTestHarness(202);
  const sockets = {
    p1: createSocketStub('sock-1'),
    p2: createSocketStub('sock-2'),
    p3: createSocketStub('sock-3'),
  };

  const { code } = await emitWithAck(handlers['room:create'], sockets.p1, {
    playerId: 'p1',
    name: 'P1',
  });
  await emitWithAck(handlers['room:join'], sockets.p2, { code, playerId: 'p2', name: 'P2' });
  await emitWithAck(handlers['room:join'], sockets.p3, { code, playerId: 'p3', name: 'P3' });
  await emitWithAck(handlers['game:start'], sockets.p1, {});

  const room = roomStore.getRoom(code);
  // Deterministic hands: p1 has reverse, opponents have no nope
  room.game.players[0].hand = [CARD.reverse, CARD.defuse];
  room.game.players[1].hand = [CARD.skip, CARD.defuse];
  room.game.players[2].hand = [CARD.attack, CARD.defuse];

  const actionRes = await emitWithAck(handlers['game:action'], sockets.p1, {
    type: 'play',
    card: 'reverse',
  });
  assert.equal(actionRes.ok, true);

  // Auto-resolved immediately because no opponent holds nope
  assert.equal(room.game.phase, 'play');
  assert.equal(room.game.pendingAction, null);
  assert.equal(room.game.direction, -1);
  assert.equal(room.game.currentPlayerId, 'p3');
  assert.equal(room.game.turnsLeft, 1);

  const latestBroadcast = broadcasts[broadcasts.length - 1];
  assert.equal(latestBroadcast.views.p3.direction, -1);
  assert.equal(latestBroadcast.views.p3.currentPlayerId, 'p3');
});

test('Integration 3: nope + counter-Nope ("Yup") flow auto-resolves when no eligible nope holders remain', async () => {
  const { roomStore, handlers } = createTestHarness(303);
  const sockets = {
    p1: createSocketStub('sock-1'),
    p2: createSocketStub('sock-2'),
  };

  const { code } = await emitWithAck(handlers['room:create'], sockets.p1, {
    playerId: 'p1',
    name: 'P1',
  });
  await emitWithAck(handlers['room:join'], sockets.p2, { code, playerId: 'p2', name: 'P2' });
  await emitWithAck(handlers['game:start'], sockets.p1, {});

  const room = roomStore.getRoom(code);
  room.game.players[0].hand = [CARD.attack, CARD.nope, CARD.defuse];
  room.game.players[1].hand = [CARD.nope, CARD.skip, CARD.defuse];

  // 1. p1 plays attack -> p2 holds nope so game stays in phase === 'nope'
  const res1 = await emitWithAck(handlers['game:action'], sockets.p1, {
    type: 'play',
    card: 'attack',
  });
  assert.equal(res1.ok, true);
  assert.equal(room.game.phase, 'nope');
  assert.equal(room.game.pendingAction.card, CARD.attack);
  assert.equal(room.game.pendingAction.nopeCount, 0);
  assert.equal(room.game.pendingAction.lastActorId, 'p1');

  // 2. p2 plays nope -> nopeCount === 1; p1 still holds nope so phase remains 'nope'
  const res2 = await emitWithAck(handlers['game:action'], sockets.p2, {
    type: 'nope',
  });
  assert.equal(res2.ok, true);
  assert.equal(room.game.phase, 'nope');
  assert.equal(room.game.pendingAction.nopeCount, 1);
  assert.equal(room.game.pendingAction.lastActorId, 'p2');

  // 3. p1 counter-Nopes -> nopeCount === 2; p2 has no more nope -> auto-resolves & attack executes!
  const res3 = await emitWithAck(handlers['game:action'], sockets.p1, {
    type: 'nope',
  });
  assert.equal(res3.ok, true);
  assert.equal(room.game.phase, 'play');
  assert.equal(room.game.pendingAction, null);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.equal(room.game.turnsLeft, 2);
});

test('Integration 4: taco and potato pair plays steal cards cleanly via game:action', async () => {
  const { roomStore, handlers } = createTestHarness(404);
  const sockets = {
    p1: createSocketStub('sock-1'),
    p2: createSocketStub('sock-2'),
  };

  const { code } = await emitWithAck(handlers['room:create'], sockets.p1, {
    playerId: 'p1',
    name: 'P1',
  });
  await emitWithAck(handlers['room:join'], sockets.p2, { code, playerId: 'p2', name: 'P2' });
  await emitWithAck(handlers['game:start'], sockets.p1, {});

  const room = roomStore.getRoom(code);
  room.game.players[0].hand = [CARD.taco, CARD.taco, CARD.potato, CARD.potato, CARD.defuse];
  room.game.players[1].hand = [CARD.skip, CARD.attack, CARD.peek];

  // 1. Play taco pair
  const tacoRes = await emitWithAck(handlers['game:action'], sockets.p1, {
    type: 'catPair',
    card: 'taco',
    target: 'p2',
  });
  assert.equal(tacoRes.ok, true);
  assert.equal(room.game.phase, 'play');
  assert.equal(room.game.players[0].hand.filter(c => c === CARD.taco).length, 0);
  assert.equal(room.game.players[0].hand.length, 4); // 5 - 2 + 1 stolen
  assert.equal(room.game.players[1].hand.length, 2);
  assert.deepEqual(room.game.discardPile.slice(-2), [CARD.taco, CARD.taco]);

  // 2. Play potato pair
  const potatoRes = await emitWithAck(handlers['game:action'], sockets.p1, {
    type: 'catPair',
    card: 'potato',
    target: 'p2',
  });
  assert.equal(potatoRes.ok, true);
  assert.equal(room.game.phase, 'play');
  assert.equal(room.game.players[0].hand.filter(c => c === CARD.potato).length, 0);
  assert.equal(room.game.players[0].hand.length, 3); // 4 - 2 + 1 stolen
  assert.equal(room.game.players[1].hand.length, 1);
  assert.deepEqual(room.game.discardPile.slice(-2), [CARD.potato, CARD.potato]);
});

test('Integration 5: room:leave during active game eliminates leaver and finishes 2-player match', async () => {
  const { roomStore, handlers } = createTestHarness(505);
  const sockets = {
    p1: createSocketStub('sock-1'),
    p2: createSocketStub('sock-2'),
  };

  const { code } = await emitWithAck(handlers['room:create'], sockets.p1, {
    playerId: 'p1',
    name: 'P1',
  });
  await emitWithAck(handlers['room:join'], sockets.p2, { code, playerId: 'p2', name: 'P2' });
  await emitWithAck(handlers['game:start'], sockets.p1, {});

  const room = roomStore.getRoom(code);
  assert.equal(room.status, 'playing');

  const leaveRes = await emitWithAck(handlers['room:leave'], sockets.p1, {});
  assert.equal(leaveRes.ok, true);
  assert.equal(room.players.length, 1);
  assert.equal(room.status, 'finished');
  assert.equal(room.game.phase, 'over');
  assert.equal(room.game.winnerId, 'p2');
});

test('Integration 6: live turn timer preserves deadline on peer disconnect/resume and advances turn at 0s', async () => {
  const port = 43139;
  const srv = spawn('node', [path.join(serverDir, 'index.mjs')], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      TURN_TIMEOUT_MS: '900',
      NOPE_WINDOW_MS: '350',
      DISCONNECT_GRACE_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let c1 = null;
  let c2 = null;

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server failed to start')), 5000);
      srv.stdout.on('data', chunk => {
        if (chunk.toString().includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      srv.stderr.on('data', chunk => {
        const text = chunk.toString();
        if (text.includes('EADDRINUSE')) {
          clearTimeout(timeout);
          reject(new Error(text));
        }
      });
    });

    c1 = createIoClient(`http://localhost:${port}`, { transports: ['websocket'] });
    c2 = createIoClient(`http://localhost:${port}`, { transports: ['websocket'] });
    const states1 = [];
    const roomStates1 = [];
    const waiters = [];
    const checkWaiters = () => {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i]()) waiters.splice(i, 1);
      }
    };
    c1.on('game:state', s => {
      states1.push(s);
      checkWaiters();
    });
    c1.on('room:state', r => {
      roomStates1.push(r);
      checkWaiters();
    });

    const waitFor = (fn, ms = 4000) =>
      new Promise((resolve, reject) => {
        if (fn()) return resolve();
        const timer = setTimeout(() => reject(new Error('Timed out waiting for state')), ms);
        waiters.push(() => {
          if (fn()) {
            clearTimeout(timer);
            resolve();
            return true;
          }
          return false;
        });
      });

    const emitAck = (client, ev, data) => new Promise(r => client.emit(ev, data, r));
    await Promise.all([
      new Promise(r => c1.on('connect', r)),
      new Promise(r => c2.on('connect', r)),
    ]);

    const cr = await emitAck(c1, 'room:create', { playerId: 'p1', name: 'P1' });
    assert.equal(cr.ok, true);
    await emitAck(c2, 'room:join', { playerId: 'p2', name: 'P2', code: cr.code });
    await emitAck(c1, 'game:start', { playerId: 'p1', code: cr.code });

    await waitFor(() => states1.length >= 1);
    const initialState = states1[states1.length - 1];
    assert.equal(initialState.currentPlayerId, 'p1');
    assert.equal(typeof initialState.turnDeadline, 'number');
    assert.equal(typeof initialState.serverNow, 'number');

    // Peer disconnects mid-turn: deadline for p1 MUST NOT be pushed back
    c2.close();
    c2 = null;
    await waitFor(() =>
      roomStates1.some(r => r.players?.find(p => p.id === 'p2')?.connected === false)
    );
    const afterPeerDisconnect = states1[states1.length - 1];
    assert.equal(afterPeerDisconnect.version, initialState.version);
    assert.equal(afterPeerDisconnect.turnDeadline, initialState.turnDeadline);

    // Wait for turn timer to advance to p2 (or first resolve defuse if bomb drawn, then advance to p2)
    await waitFor(() => {
      const latest = states1[states1.length - 1];
      return latest.version > initialState.version && latest.currentPlayerId === 'p2';
    }, 4500);

    const afterTimeout = states1[states1.length - 1];
    assert.ok(afterTimeout.version > initialState.version);
    assert.equal(afterTimeout.currentPlayerId, 'p2');
  } finally {
    c1?.close();
    c2?.close();
    srv.kill('SIGKILL');
  }
});
