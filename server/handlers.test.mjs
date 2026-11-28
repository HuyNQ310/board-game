/**
 * Mèo Nổ — Server Handlers Unit Tests
 * Uses node:test and node:assert/strict with pure fakes (no external dependencies).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHandlers,
  createRateLimiter,
  RoomQueue,
  validateGameActionPayload,
  ERROR_MESSAGES,
} from './handlers.mjs';

// Helper for testing acks: records call count and received response
function createTestAck() {
  let callCount = 0;
  let response = null;
  const ack = (res) => {
    callCount += 1;
    response = res;
  };
  return {
    ack,
    getCallCount: () => callCount,
    getResponse: () => response,
  };
}

describe('Rate Limiter (createRateLimiter)', () => {
  it('allows up to 10 events per 1-second window and blocks the 11th event', () => {
    let currentTime = 1000;
    const limiter = createRateLimiter({
      max: 10,
      windowMs: 1000,
      now: () => currentTime,
    });

    const socketId = 'sock-test-1';

    // First 10 events within the 1-second window are allowed
    for (let i = 1; i <= 10; i++) {
      const allowed = limiter.consume(socketId);
      assert.equal(allowed, true, `Event #${i} should be allowed`);
    }

    // 11th event within the same window is blocked
    const eleventh = limiter.consume(socketId);
    assert.equal(eleventh, false, '11th event within 1s should be blocked');

    // 12th event is also blocked
    const twelfth = limiter.consume(socketId);
    assert.equal(twelfth, false, '12th event within 1s should still be blocked');

    // After 1001ms, window rolls forward and events are allowed again
    currentTime += 1001;
    const afterWindow = limiter.consume(socketId);
    assert.equal(afterWindow, true, 'Event after 1s window expires should be allowed');
  });

  it('tracks different sockets independently', () => {
    let currentTime = 1000;
    const limiter = createRateLimiter({
      max: 10,
      windowMs: 1000,
      now: () => currentTime,
    });

    for (let i = 0; i < 10; i++) {
      limiter.consume('socket-a');
    }
    assert.equal(limiter.consume('socket-a'), false, 'socket-a should be at rate limit');
    assert.equal(limiter.consume('socket-b'), true, 'socket-b should not be affected');
  });

  it('resets counter on reset()', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => 1000 });
    limiter.consume('sock');
    limiter.consume('sock');
    assert.equal(limiter.consume('sock'), false);

    limiter.reset('sock');
    assert.equal(limiter.consume('sock'), true);
  });
});

describe('RoomQueue (D11 per-room serialization)', () => {
  it('runs tasks sequentially per room code', async () => {
    const queue = new RoomQueue();
    const order = [];

    const p1 = queue.run('ROOM1', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });

    const p2 = queue.run('ROOM1', async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    assert.deepEqual(order, [1, 2]);
  });
});

describe('validateGameActionPayload', () => {
  it('rejects null, non-object or missing type payloads with INVALID_ACTION', () => {
    assert.deepEqual(validateGameActionPayload(null), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload(undefined), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload('string'), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({}), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'dance' }), { ok: false, code: 'INVALID_ACTION' });
  });

  it('validates type: "draw"', () => {
    assert.deepEqual(validateGameActionPayload({ type: 'draw' }), {
      ok: true,
      action: { type: 'draw' },
    });
  });

  it('validates type: "play" with valid cards including reverse', () => {
    for (const card of ['skip', 'attack', 'reverse', 'shuffle', 'peek']) {
      assert.deepEqual(validateGameActionPayload({ type: 'play', card }), {
        ok: true,
        action: { type: 'play', card },
      });
    }
  });

  it('normalizes type: "play", card: "nope" and validates standalone nope / passNope', () => {
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'nope' }), {
      ok: true,
      action: { type: 'nope' },
    });
    assert.deepEqual(validateGameActionPayload({ type: 'nope' }), {
      ok: true,
      action: { type: 'nope' },
    });
    assert.deepEqual(validateGameActionPayload({ type: 'passNope' }), {
      ok: true,
      action: { type: 'passNope' },
    });
  });

  it('rejects type: "play" with invalid or unplayable cards with INVALID_ACTION', () => {
    assert.deepEqual(validateGameActionPayload({ type: 'play' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'boom' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'defuse' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'cat' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'taco' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'potato' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'play', card: 'unknown' }), { ok: false, code: 'INVALID_ACTION' });
  });

  it('requires target for favor and rejects missing/invalid target with INVALID_TARGET', () => {
    assert.deepEqual(
      validateGameActionPayload({ type: 'play', card: 'favor' }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'play', card: 'favor', target: '' }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'play', card: 'favor', target: '   ' }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'play', card: 'favor', target: 'player-2' }),
      { ok: true, action: { type: 'play', card: 'favor', target: 'player-2' } }
    );
  });

  it('requires target for catPair and validates optional cat card (cat, taco, potato)', () => {
    assert.deepEqual(
      validateGameActionPayload({ type: 'catPair' }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'catPair', target: '' }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'catPair', target: 123 }),
      { ok: false, code: 'INVALID_TARGET' }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'catPair', target: 'player-3' }),
      { ok: true, action: { type: 'catPair', target: 'player-3' } }
    );
    for (const card of ['cat', 'taco', 'potato']) {
      assert.deepEqual(
        validateGameActionPayload({ type: 'catPair', card, target: ' player-3 ' }),
        { ok: true, action: { type: 'catPair', card, target: 'player-3' } }
      );
    }
    for (const badCard of ['skip', 'nope', '', null, 42]) {
      assert.deepEqual(
        validateGameActionPayload({ type: 'catPair', card: badCard, target: 'player-3' }),
        { ok: false, code: 'INVALID_ACTION' }
      );
    }
  });

  it('validates defuse with insertAt number and rejects missing/invalid insertAt', () => {
    assert.deepEqual(validateGameActionPayload({ type: 'defuse' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'defuse', insertAt: 'top' }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(validateGameActionPayload({ type: 'defuse', insertAt: NaN }), { ok: false, code: 'INVALID_ACTION' });
    assert.deepEqual(
      validateGameActionPayload({ type: 'defuse', insertAt: 0 }),
      { ok: true, action: { type: 'defuse', insertAt: 0 } }
    );
    assert.deepEqual(
      validateGameActionPayload({ type: 'defuse', insertAt: 3.8 }),
      { ok: true, action: { type: 'defuse', insertAt: 3 } }
    );
  });
});

describe('Handler: room:create', () => {
  it('calls ack exactly once with { ok: true, code } on success, updates socket, and broadcasts state', async () => {
    const fakeRoom = {
      code: 'ABCDE',
      hostId: 'p1',
      status: 'lobby',
      players: [{ id: 'p1', name: 'Alice', connected: true, seat: 0 }],
      game: null,
    };

    let broadcastedRoom = null;
    const fakeBroadcast = (room) => {
      broadcastedRoom = room;
    };

    const fakeRoomStore = {
      createRoom: async ({ hostPlayerId, hostName }) => {
        assert.equal(hostPlayerId, 'p1');
        assert.equal(hostName, 'Alice');
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      broadcastState: fakeBroadcast,
    });

    const joinedRooms = [];
    const socket = { id: 'sock-1', join: (c) => joinedRooms.push(c) };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:create'](socket, { playerId: 'p1', name: 'Alice' }, ack);

    assert.equal(getCallCount(), 1, 'ack must be called exactly once');
    assert.deepEqual(getResponse(), { ok: true, code: 'ABCDE' });
    assert.equal(socket.roomCode, 'ABCDE');
    assert.equal(socket.playerId, 'p1');
    assert.equal(socket.data.roomCode, 'ABCDE');
    assert.equal(socket.data.playerId, 'p1');
    assert.equal(broadcastedRoom, fakeRoom, 'broadcastState should be called with created room');
    assert.ok(joinedRooms.includes('ABCDE'), 'socket should join the room code channel');
    assert.ok(joinedRooms.includes('p1'), 'socket should join its own playerId channel for private game:state');
  });

  it('rejects invalid names with NAME_INVALID and does NOT broadcast state', async () => {
    let broadcastCalled = false;
    const handlers = createHandlers({
      roomStore: { createRoom: () => {} },
      broadcastState: () => { broadcastCalled = true; },
    });

    const socket = { id: 'sock-1' };

    // Empty name
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['room:create'](socket, { playerId: 'p1', name: '   ' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'NAME_INVALID',
        message: ERROR_MESSAGES.NAME_INVALID,
      });
      assert.equal(broadcastCalled, false);
    }

    // Name too long (> 16 chars)
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['room:create'](socket, { playerId: 'p1', name: 'ThisNameIsWayTooLongForGame' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'NAME_INVALID',
        message: ERROR_MESSAGES.NAME_INVALID,
      });
      assert.equal(broadcastCalled, false);
    }
  });

  it('rejects missing playerId with INVALID_ACTION', async () => {
    const handlers = createHandlers({ roomStore: {} });
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:create']({ id: 's1' }, { name: 'Bob' }, ack);
    assert.equal(getCallCount(), 1);
    assert.equal(getResponse().ok, false);
    assert.equal(getResponse().code, 'INVALID_ACTION');
  });

  it('maps roomStore errors to ack and does NOT broadcast', async () => {
    let broadcastCalled = false;
    const handlers = createHandlers({
      roomStore: {
        createRoom: async () => {
          const err = new Error('Room limit');
          err.code = 'SERVER_ERROR';
          throw err;
        },
      },
      broadcastState: () => { broadcastCalled = true; },
    });

    const { ack, getCallCount, getResponse } = createTestAck();
    await handlers['room:create']({ id: 's1' }, { playerId: 'p1', name: 'Charlie' }, ack);

    assert.equal(getCallCount(), 1);
    assert.equal(getResponse().ok, false);
    assert.equal(getResponse().code, 'SERVER_ERROR');
    assert.equal(broadcastCalled, false);
  });
});

describe('Handler: room:join', () => {
  it('calls ack exactly once with { ok: true, code } on success and broadcasts state', async () => {
    const fakeRoom = {
      code: 'ROOM1',
      hostId: 'p1',
      status: 'lobby',
      players: [
        { id: 'p1', name: 'Host', connected: true },
        { id: 'p2', name: 'Guest', connected: true },
      ],
    };

    let broadcastedRoom = null;
    const fakeRoomStore = {
      joinRoom: async (code, { playerId, name }) => {
        assert.equal(code, 'ROOM1');
        assert.equal(playerId, 'p2');
        assert.equal(name, 'Guest');
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    const joinedRooms = [];
    const socket = { id: 's2', join: (c) => joinedRooms.push(c) };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:join'](socket, { playerId: 'p2', name: 'Guest', code: 'room1' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true, code: 'ROOM1' });
    assert.equal(socket.roomCode, 'ROOM1');
    assert.equal(socket.playerId, 'p2');
    assert.equal(broadcastedRoom, fakeRoom);
    assert.ok(joinedRooms.includes('ROOM1'), 'socket should join the room code channel');
    assert.ok(joinedRooms.includes('p2'), 'socket should join its own playerId channel for private game:state');
  });

  it('handles ROOM_NOT_FOUND, ROOM_FULL, and ROOM_PLAYING errors without broadcasting', async () => {
    for (const errorCode of ['ROOM_NOT_FOUND', 'ROOM_FULL', 'ROOM_PLAYING']) {
      let broadcastCalled = false;
      const handlers = createHandlers({
        roomStore: {
          joinRoom: async () => {
            const err = new Error(errorCode);
            err.code = errorCode;
            throw err;
          },
        },
        broadcastState: () => { broadcastCalled = true; },
      });

      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['room:join']({ id: 's1' }, { playerId: 'p2', name: 'Guest', code: 'ROOM1' }, ack);

      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: errorCode,
        message: ERROR_MESSAGES[errorCode],
      });
      assert.equal(broadcastCalled, false, `broadcastState must not be called on ${errorCode}`);
    }
  });

  it('rejects missing or blank room code with ROOM_NOT_FOUND', async () => {
    const handlers = createHandlers({ roomStore: {} });
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:join']({ id: 's1' }, { playerId: 'p1', name: 'Guest', code: '' }, ack);
    assert.equal(getCallCount(), 1);
    assert.equal(getResponse().ok, false);
    assert.equal(getResponse().code, 'ROOM_NOT_FOUND');
  });
});

describe('Handler: room:resume', () => {
  it('calls ack with { ok: true, code, room, game } and broadcasts on success', async () => {
    const fakeRoom = {
      code: 'RES1',
      hostId: 'p1',
      status: 'playing',
      players: [{ id: 'p1', name: 'An', connected: true, socketId: 's1' }],
      game: { version: 5, phase: 'play' },
    };

    let broadcastedRoom = null;
    const fakeEngine = {
      viewFor: (game, pid) => {
        assert.equal(pid, 'p1');
        return { version: game.version, phase: game.phase, viewOf: pid };
      },
    };

    const fakeRoomStore = {
      getRoom: async () => fakeRoom,
      markReconnected: async () => fakeRoom,
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      engine: fakeEngine,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    const socket = { id: 's1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:resume'](socket, { playerId: 'p1', code: 'res1' }, ack);

    assert.equal(getCallCount(), 1);
    const resp = getResponse();
    assert.equal(resp.ok, true);
    assert.equal(resp.code, 'RES1');
    assert.equal(resp.room.code, 'RES1');
    assert.equal(resp.room.game, undefined, 'room object in ack should omit raw game');
    assert.deepEqual(resp.game, { version: 5, phase: 'play', viewOf: 'p1' });
    assert.equal(broadcastedRoom, fakeRoom);
  });

  it('signals replaceSession(oldSocketId) when player reconnects with a new socket', async () => {
    const fakeRoom = {
      code: 'RES2',
      hostId: 'p1',
      status: 'lobby',
      players: [{ id: 'p1', name: 'An', connected: true, socketId: 'old-socket-id' }],
      game: null,
    };

    let replacedOldSocketId = null;
    const fakeReplaceSession = (oldId) => {
      replacedOldSocketId = oldId;
    };

    const fakeRoomStore = {
      getRoom: async () => fakeRoom,
      markReconnected: async () => fakeRoom,
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      replaceSession: fakeReplaceSession,
    });

    const newSocket = { id: 'new-socket-id' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:resume'](newSocket, { playerId: 'p1', code: 'RES2' }, ack);

    assert.equal(getCallCount(), 1);
    assert.equal(getResponse().ok, true);
    assert.equal(replacedOldSocketId, 'old-socket-id', 'replaceSession must be called with oldSocketId');
  });

  it('does NOT call replaceSession if oldSocketId matches current socket id', async () => {
    let replaceCalled = false;
    const fakeRoom = {
      code: 'RES3',
      hostId: 'p1',
      status: 'lobby',
      players: [{ id: 'p1', name: 'An', connected: true, socketId: 'same-socket' }],
      game: null,
    };

    const handlers = createHandlers({
      roomStore: {
        getRoom: async () => fakeRoom,
        markReconnected: async () => fakeRoom,
      },
      replaceSession: () => { replaceCalled = true; },
    });

    const socket = { id: 'same-socket' };
    const { ack } = createTestAck();

    await handlers['room:resume'](socket, { playerId: 'p1', code: 'RES3' }, ack);
    assert.equal(replaceCalled, false);
  });

  it('handles ROOM_NOT_FOUND and NOT_IN_ROOM errors without broadcasting', async () => {
    let broadcastCalled = false;
    const handlers = createHandlers({
      roomStore: {
        getRoom: async () => null,
        markReconnected: async () => {
          const err = new Error('Not in room');
          err.code = 'NOT_IN_ROOM';
          throw err;
        },
      },
      broadcastState: () => { broadcastCalled = true; },
    });

    const { ack, getCallCount, getResponse } = createTestAck();
    await handlers['room:resume']({ id: 's1' }, { playerId: 'p99', code: 'RES1' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NOT_IN_ROOM',
      message: ERROR_MESSAGES.NOT_IN_ROOM,
    });
    assert.equal(broadcastCalled, false);
  });

  it('is NOT blocked by rate limiter even when socket has exceeded rate limit', async () => {
    let currentTime = 1000;
    const fakeRoom = {
      code: 'RL1',
      hostId: 'p1',
      status: 'lobby',
      players: [{ id: 'p1', name: 'An', connected: true }],
      game: null,
    };

    const handlers = createHandlers({
      roomStore: {
        createRoom: async () => fakeRoom,
        getRoom: async () => fakeRoom,
        markReconnected: async () => fakeRoom,
      },
      now: () => currentTime,
    });

    const socket = { id: 'rate-limited-sock' };

    // Consume 10 events via room:create to hit limit
    for (let i = 0; i < 10; i++) {
      const { ack } = createTestAck();
      await handlers['room:create'](socket, { playerId: 'p1', name: 'Test' }, ack);
    }

    // 11th room:create is blocked by rate limit
    {
      const { ack, getResponse } = createTestAck();
      await handlers['room:create'](socket, { playerId: 'p1', name: 'Test' }, ack);
      assert.equal(getResponse().ok, false);
      assert.equal(getResponse().code, 'RATE_LIMIT');
    }

    // room:resume MUST NOT be blocked!
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['room:resume'](socket, { playerId: 'p1', code: 'RL1' }, ack);
      assert.equal(getCallCount(), 1);
      assert.equal(getResponse().ok, true, 'room:resume must succeed even when rate limited');
      assert.equal(getResponse().code, 'RL1');
    }
  });
});

describe('Handler: room:leave', () => {
  it('calls ack exactly once with { ok: true }, clears socket, and broadcasts state', async () => {
    const fakeRoom = {
      code: 'LEAVE1',
      hostId: 'p2',
      status: 'lobby',
      players: [{ id: 'p2', name: 'Bob', connected: true }],
    };

    let broadcastedRoom = null;
    let leaveRoomArgs = null;

    const fakeRoomStore = {
      leaveRoom: async (code, playerId) => {
        leaveRoomArgs = { code, playerId };
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    let socketLeft = false;
    const socket = {
      id: 's1',
      playerId: 'p1',
      roomCode: 'LEAVE1',
      data: { playerId: 'p1', roomCode: 'LEAVE1' },
      leave: (c) => { socketLeft = (c === 'LEAVE1'); },
    };

    const { ack, getCallCount, getResponse } = createTestAck();
    await handlers['room:leave'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.deepEqual(leaveRoomArgs, { code: 'LEAVE1', playerId: 'p1' });
    assert.equal(socketLeft, true);
    assert.equal(socket.playerId, undefined);
    assert.equal(socket.roomCode, undefined);
    assert.equal(broadcastedRoom, fakeRoom);
  });

  it('rejects with NOT_IN_ROOM if socket has no room/player context', async () => {
    let broadcastCalled = false;
    const handlers = createHandlers({
      roomStore: { leaveRoom: async () => {} },
      broadcastState: () => { broadcastCalled = true; },
    });

    const socket = { id: 's-none' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:leave'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NOT_IN_ROOM',
      message: ERROR_MESSAGES.NOT_IN_ROOM,
    });
    assert.equal(broadcastCalled, false);
  });
});

describe('Handler: game:start', () => {
  it('calls ack with { ok: true } and broadcasts on success', async () => {
    const fakeRoom = {
      code: 'START1',
      hostId: 'p1',
      status: 'lobby',
      players: [
        { id: 'p1', name: 'Alice', connected: true },
        { id: 'p2', name: 'Bob', connected: true },
      ],
      game: null,
    };

    let broadcastedRoom = null;
    const fakeEngine = {
      createGame: (playerIds) => {
        assert.deepEqual(playerIds, [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ]);
        return { version: 0, phase: 'play' };
      },
    };

    const fakeRoomStore = {
      startGame: async (code, playerId) => {
        assert.equal(code, 'START1');
        assert.equal(playerId, 'p1');
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      engine: fakeEngine,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'START1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:start'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(fakeRoom.status, 'playing');
    assert.deepEqual(fakeRoom.game, { version: 0, phase: 'play' });
    assert.equal(broadcastedRoom, fakeRoom);
  });

  it('rejects when caller is not host with NOT_HOST and does NOT broadcast', async () => {
    let broadcastCalled = false;
    const fakeRoomStore = {
      startGame: async () => {
        const err = new Error('Not host');
        err.code = 'NOT_HOST';
        throw err;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      broadcastState: () => { broadcastCalled = true; },
    });

    const socket = { id: 's2', playerId: 'p2', roomCode: 'START1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:start'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NOT_HOST',
      message: ERROR_MESSAGES.NOT_HOST,
    });
    assert.equal(broadcastCalled, false);
  });

  it('rejects when roomStore throws NEED_TWO_PLAYERS', async () => {
    const handlers = createHandlers({
      roomStore: {
        startGame: async () => {
          const err = new Error('Need two players');
          err.code = 'NEED_TWO_PLAYERS';
          throw err;
        },
      },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'START1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:start'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NEED_TWO_PLAYERS',
      message: ERROR_MESSAGES.NEED_TWO_PLAYERS,
    });
  });
});

describe('Handler: game:action', () => {
  it('rejects malformed payload before calling engine and without broadcasting', async () => {
    let engineCalled = false;
    let broadcastCalled = false;

    const handlers = createHandlers({
      engine: {
        applyAction: async () => { engineCalled = true; },
      },
      broadcastState: () => { broadcastCalled = true; },
      roomStore: {
        getRoom: async () => ({
          code: 'ACT1',
          status: 'playing',
          players: [{ id: 'p1' }],
          game: {},
        }),
      },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'ACT1' };

    // Unknown action type
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['game:action'](socket, { type: 'unknown_type' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'INVALID_ACTION',
        message: ERROR_MESSAGES.INVALID_ACTION,
      });
      assert.equal(engineCalled, false);
      assert.equal(broadcastCalled, false);
    }

    // Missing target for favor
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['game:action'](socket, { type: 'play', card: 'favor' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'INVALID_TARGET',
        message: ERROR_MESSAGES.INVALID_TARGET,
      });
      assert.equal(engineCalled, false);
      assert.equal(broadcastCalled, false);
    }

    // Missing target for catPair
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['game:action'](socket, { type: 'catPair' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'INVALID_TARGET',
        message: ERROR_MESSAGES.INVALID_TARGET,
      });
      assert.equal(engineCalled, false);
      assert.equal(broadcastCalled, false);
    }

    // Missing insertAt for defuse
    {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers['game:action'](socket, { type: 'defuse' }, ack);
      assert.equal(getCallCount(), 1);
      assert.deepEqual(getResponse(), {
        ok: false,
        code: 'INVALID_ACTION',
        message: ERROR_MESSAGES.INVALID_ACTION,
      });
      assert.equal(engineCalled, false);
      assert.equal(broadcastCalled, false);
    }
  });

  it('applies valid action to engine, updates room.game, calls broadcastState, and acks ok: true', async () => {
    const initialGame = { version: 1, phase: 'play' };
    const updatedGame = { version: 2, phase: 'play' };
    const fakeRoom = {
      code: 'ACT1',
      status: 'playing',
      players: [{ id: 'p1', connected: true }],
      game: initialGame,
    };

    let broadcastedRoom = null;
    let appliedAction = null;

    const fakeEngine = {
      applyAction: async (state, playerId, action) => {
        assert.equal(state, initialGame);
        assert.equal(playerId, 'p1');
        appliedAction = action;
        return updatedGame;
      },
    };

    const fakeRoomStore = {
      getRoom: async (code) => {
        assert.equal(code, 'ACT1');
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      engine: fakeEngine,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'ACT1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'draw' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.deepEqual(appliedAction, { type: 'draw' });
    assert.equal(fakeRoom.game, updatedGame);
    assert.equal(broadcastedRoom, fakeRoom);
  });

  it('marks room status finished when game phase is over', async () => {
    const fakeRoom = {
      code: 'ACT2',
      status: 'playing',
      players: [{ id: 'p1', connected: true }],
      game: { version: 10, phase: 'play' },
    };

    const fakeEngine = {
      applyAction: async () => ({ version: 11, phase: 'over', winnerId: 'p1' }),
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: () => {},
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'ACT2' };
    const { ack } = createTestAck();

    await handlers['game:action'](socket, { type: 'draw' }, ack);
    assert.equal(fakeRoom.status, 'finished');
  });

  it('maps GameError to code via mapGameErrorToCode and toErrorAck, emits game:error, and does NOT broadcast', async () => {
    let broadcastCalled = false;
    let socketEmittedError = null;

    class FakeGameError extends Error {
      constructor(message) {
        super(message);
        this.name = 'GameError';
      }
    }

    const fakeEngine = {
      applyAction: async () => {
        throw new FakeGameError('Not your turn');
      },
    };

    const fakeMapError = (err) => {
      if (err instanceof FakeGameError) return 'NOT_YOUR_TURN';
      return 'SERVER_ERROR';
    };

    const fakeToErrorAck = (code) => ({
      ok: false,
      code,
      message: ERROR_MESSAGES[code] || 'Error',
    });

    const handlers = createHandlers({
      roomStore: {
        getRoom: async () => ({
          code: 'ACT3',
          status: 'playing',
          players: [{ id: 'p1' }],
          game: { version: 1 },
        }),
      },
      engine: fakeEngine,
      mapGameErrorToCode: fakeMapError,
      toErrorAck: fakeToErrorAck,
      broadcastState: () => { broadcastCalled = true; },
    });

    const socket = {
      id: 's1',
      playerId: 'p1',
      roomCode: 'ACT3',
      emit: (event, payload) => {
        if (event === 'game:error') {
          socketEmittedError = payload;
        }
      },
    };

    const { ack, getCallCount, getResponse } = createTestAck();
    await handlers['game:action'](socket, { type: 'draw' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NOT_YOUR_TURN',
      message: ERROR_MESSAGES.NOT_YOUR_TURN,
    });
    assert.deepEqual(socketEmittedError, {
      code: 'NOT_YOUR_TURN',
      message: ERROR_MESSAGES.NOT_YOUR_TURN,
    });
    assert.equal(broadcastCalled, false, 'broadcastState must not be called when action fails');
  });

  it('rejects action with GAME_OVER if room status is already finished', async () => {
    const handlers = createHandlers({
      roomStore: {
        getRoom: async () => ({
          code: 'ACT4',
          status: 'finished',
          players: [{ id: 'p1' }],
          game: { version: 20 },
        }),
      },
      engine: { applyAction: async () => {} },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'ACT4' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'draw' }, ack);
    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'GAME_OVER',
      message: ERROR_MESSAGES.GAME_OVER,
    });
  });

  it('auto-resolves nope phase immediately when engine.hasEligibleNopeHolder returns false', async () => {
    const nopeGame = { version: 2, phase: 'nope', currentPlayerId: 'p1', pendingAction: { type: 'skip' } };
    const resolvedGame = { version: 3, phase: 'play', currentPlayerId: 'p2' };
    const fakeRoom = {
      code: 'NOPE1',
      status: 'playing',
      players: [{ id: 'p1', connected: true }, { id: 'p2', connected: true }],
      game: { version: 1, phase: 'play', currentPlayerId: 'p1' },
    };

    let resolveCalledWith = null;
    let broadcastedGame = null;

    const fakeEngine = {
      applyAction: async () => nopeGame,
      hasEligibleNopeHolder: (state) => {
        assert.equal(state, nopeGame);
        return false;
      },
      resolvePendingAction: async (state) => {
        resolveCalledWith = state;
        return resolvedGame;
      },
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: (r) => { broadcastedGame = r.game; },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'NOPE1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'play', card: 'skip' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(resolveCalledWith, nopeGame);
    assert.equal(fakeRoom.game, resolvedGame);
    assert.equal(broadcastedGame, resolvedGame);
  });

  it('falls back to applyAction resolveNope when resolvePendingAction is unavailable and hasEligibleNopeHolder is false', async () => {
    const nopeGame = { version: 2, phase: 'nope', currentPlayerId: 'p1', pendingAction: { type: 'skip' } };
    const resolvedGame = { version: 3, phase: 'over', winnerId: 'p1' };
    const fakeRoom = {
      code: 'NOPE2',
      status: 'playing',
      players: [{ id: 'p1', connected: true }, { id: 'p2', connected: true }],
      game: { version: 1, phase: 'play', currentPlayerId: 'p1' },
    };

    const calls = [];
    const fakeEngine = {
      applyAction: async (state, pid, action) => {
        calls.push({ state, pid, action });
        if (calls.length === 1) return nopeGame;
        return resolvedGame;
      },
      hasEligibleNopeHolder: () => false,
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: () => {},
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'NOPE2' };
    const { ack, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'play', card: 'skip' }, ack);

    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].action, { type: 'resolveNope' });
    assert.equal(calls[1].pid, 'p1');
    assert.equal(fakeRoom.game, resolvedGame);
    assert.equal(fakeRoom.status, 'finished');
  });

  it('stays in nope phase when engine.hasEligibleNopeHolder returns true', async () => {
    const nopeGame = { version: 2, phase: 'nope', currentPlayerId: 'p1', pendingAction: { type: 'reverse' } };
    const fakeRoom = {
      code: 'NOPE3',
      status: 'playing',
      players: [{ id: 'p1', connected: true }, { id: 'p2', connected: true }],
      game: { version: 1, phase: 'play', currentPlayerId: 'p1' },
    };

    let resolveCalled = false;
    let broadcastedGame = null;

    const fakeEngine = {
      applyAction: async () => nopeGame,
      hasEligibleNopeHolder: () => true,
      resolvePendingAction: async () => {
        resolveCalled = true;
        return {};
      },
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: (r) => { broadcastedGame = r.game; },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'NOPE3' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'play', card: 'reverse' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(resolveCalled, false);
    assert.equal(fakeRoom.game, nopeGame);
    assert.equal(broadcastedGame, nopeGame);
  });

  it('prefers engine.hasOtherLivingPlayer over hasEligibleNopeHolder and stays in nope phase even if no one holds nope', async () => {
    const nopeGame = {
      version: 2,
      phase: 'nope',
      currentPlayerId: 'p1',
      pendingAction: { type: 'play', card: 'skip', actor: 'p1', lastActorId: 'p1', nopeCount: 0, passedIds: [] },
      players: [
        { id: 'p1', alive: true, hand: ['defuse'] },
        { id: 'p2', alive: true, hand: ['cat'] },
      ],
    };
    const fakeRoom = {
      code: 'NOPE4',
      status: 'playing',
      players: [{ id: 'p1', connected: true }, { id: 'p2', connected: true }],
      game: { version: 1, phase: 'play', currentPlayerId: 'p1' },
    };

    let resolveCalled = false;
    let eligibleCalled = false;

    const fakeEngine = {
      applyAction: async () => nopeGame,
      hasOtherLivingPlayer: (state) => {
        assert.equal(state, nopeGame);
        return true;
      },
      hasEligibleNopeHolder: () => {
        eligibleCalled = true;
        return false;
      },
      resolvePendingAction: async () => {
        resolveCalled = true;
        return {};
      },
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: () => {},
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'NOPE4' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'play', card: 'skip' }, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(eligibleCalled, false);
    assert.equal(resolveCalled, false);
    assert.equal(fakeRoom.game, nopeGame);
  });

  it('auto-resolves nope phase immediately when engine.hasOtherLivingPlayer returns false', async () => {
    const nopeGame = { version: 2, phase: 'nope', currentPlayerId: 'p1', pendingAction: { type: 'skip' } };
    const resolvedGame = { version: 3, phase: 'play', currentPlayerId: 'p2' };
    const fakeRoom = {
      code: 'NOPE5',
      status: 'playing',
      players: [{ id: 'p1', connected: true }, { id: 'p2', connected: true }],
      game: { version: 1, phase: 'play', currentPlayerId: 'p1' },
    };

    let resolveCalledWith = null;
    const fakeEngine = {
      applyAction: async () => nopeGame,
      hasOtherLivingPlayer: () => false,
      hasEligibleNopeHolder: () => true,
      resolvePendingAction: async (state) => {
        resolveCalledWith = state;
        return resolvedGame;
      },
    };

    const handlers = createHandlers({
      roomStore: { getRoom: async () => fakeRoom },
      engine: fakeEngine,
      broadcastState: () => {},
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'NOPE5' };
    const { ack, getResponse } = createTestAck();

    await handlers['game:action'](socket, { type: 'play', card: 'skip' }, ack);

    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(resolveCalledWith, nopeGame);
    assert.equal(fakeRoom.game, resolvedGame);
  });
});

describe('Handler: room:rematch', () => {
  it('calls ack with { ok: true }, resets game to null and status to lobby, and broadcasts state', async () => {
    const fakeRoom = {
      code: 'REMATCH1',
      hostId: 'p1',
      status: 'finished',
      players: [{ id: 'p1', connected: true }],
      game: { version: 25 },
    };

    let broadcastedRoom = null;
    const fakeRoomStore = {
      rematch: async (code, playerId) => {
        assert.equal(code, 'REMATCH1');
        assert.equal(playerId, 'p1');
        return fakeRoom;
      },
    };

    const handlers = createHandlers({
      roomStore: fakeRoomStore,
      broadcastState: (r) => { broadcastedRoom = r; },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'REMATCH1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:rematch'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), { ok: true });
    assert.equal(fakeRoom.status, 'lobby');
    assert.equal(fakeRoom.game, null);
    assert.equal(broadcastedRoom, fakeRoom);
  });

  it('rejects with NOT_HOST when non-host requests rematch and does NOT broadcast', async () => {
    let broadcastCalled = false;
    const handlers = createHandlers({
      roomStore: {
        rematch: async () => {
          const err = new Error('Not host');
          err.code = 'NOT_HOST';
          throw err;
        },
      },
      broadcastState: () => { broadcastCalled = true; },
    });

    const socket = { id: 's2', playerId: 'p2', roomCode: 'REMATCH1' };
    const { ack, getCallCount, getResponse } = createTestAck();

    await handlers['room:rematch'](socket, {}, ack);

    assert.equal(getCallCount(), 1);
    assert.deepEqual(getResponse(), {
      ok: false,
      code: 'NOT_HOST',
      message: ERROR_MESSAGES.NOT_HOST,
    });
    assert.equal(broadcastCalled, false);
  });
});

describe('Ack Exactness and Uncaught Exception Safety', () => {
  it('each of the 7 handlers calls ack exactly once even if an unexpected error is thrown', async () => {
    const handlers = createHandlers({
      roomStore: {
        createRoom: async () => { throw new Error('DB crash'); },
        joinRoom: async () => { throw new Error('DB crash'); },
        markReconnected: async () => { throw new Error('DB crash'); },
        leaveRoom: async () => { throw new Error('DB crash'); },
        startGame: async () => { throw new Error('DB crash'); },
        getRoom: async () => { throw new Error('DB crash'); },
        rematch: async () => { throw new Error('DB crash'); },
      },
    });

    const socket = { id: 's1', playerId: 'p1', roomCode: 'ROOM1' };

    const testCases = [
      { event: 'room:create', payload: { playerId: 'p1', name: 'Alice' } },
      { event: 'room:join', payload: { playerId: 'p1', name: 'Alice', code: 'ROOM1' } },
      { event: 'room:resume', payload: { playerId: 'p1', code: 'ROOM1' } },
      { event: 'room:leave', payload: {} },
      { event: 'game:start', payload: {} },
      { event: 'game:action', payload: { type: 'draw' } },
      { event: 'room:rematch', payload: {} },
    ];

    for (const { event, payload } of testCases) {
      const { ack, getCallCount, getResponse } = createTestAck();
      await handlers[event](socket, payload, ack);

      assert.equal(getCallCount(), 1, `ack must be called exactly once for ${event}`);
      assert.equal(getResponse().ok, false, `ok must be false for ${event}`);
      assert.equal(getResponse().code, 'SERVER_ERROR', `code must be SERVER_ERROR for ${event}`);
      assert.equal(getResponse().message, ERROR_MESSAGES.SERVER_ERROR);
    }
  });
});
