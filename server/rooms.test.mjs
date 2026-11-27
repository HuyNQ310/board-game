/**
 * @file server/rooms.test.mjs
 * Unit tests for room model, lifecycle, host transfer, concurrency serialization,
 * stale room cleanup, and disconnect timers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoomCode,
  RoomStore,
  RoomError,
  withRoomQueue,
  transferHostIfNeeded,
  toRoomState,
  ROOM_CODE_ALPHABET,
} from './rooms.mjs';
import { DisconnectTimers } from './timers.mjs';

/**
 * Creates a deterministic fake clock for testing timers without real time waits.
 */
function createFakeClock() {
  let currentTime = 0;
  let nextId = 1;
  const scheduled = new Map();

  return {
    now: () => currentTime,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      scheduled.set(id, { fn, triggerAt: currentTime + ms });
      return id;
    },
    clearTimeout: (id) => {
      scheduled.delete(id);
    },
    advance: (ms) => {
      currentTime += ms;
      let executed = true;
      while (executed) {
        executed = false;
        let earliestId = null;
        let earliestTrigger = Infinity;
        for (const [id, item] of scheduled.entries()) {
          if (item.triggerAt <= currentTime && item.triggerAt < earliestTrigger) {
            earliestTrigger = item.triggerAt;
            earliestId = id;
          }
        }
        if (earliestId !== null) {
          const item = scheduled.get(earliestId);
          scheduled.delete(earliestId);
          item.fn();
          executed = true;
        }
      }
    },
    get pendingCount() {
      return scheduled.size;
    },
  };
}

describe('createRoomCode', () => {
  it('generates a 5-character string from the allowed alphabet', () => {
    const code = createRoomCode();
    assert.equal(typeof code, 'string');
    assert.equal(code.length, 5);
    for (const char of code) {
      assert.ok(ROOM_CODE_ALPHABET.includes(char), `Invalid character in room code: ${char}`);
    }
  });

  it('never contains ambiguous characters (0, O, 1, I, L)', () => {
    const forbidden = ['0', 'O', '1', 'I', 'L'];
    for (const char of forbidden) {
      assert.ok(!ROOM_CODE_ALPHABET.includes(char), `Alphabet must not include ${char}`);
    }
    for (let i = 0; i < 100; i++) {
      const code = createRoomCode();
      for (const char of forbidden) {
        assert.ok(!code.includes(char), `Generated code should not include ${char}`);
      }
    }
  });

  it('is pure and deterministic with injected rng', () => {
    // Deterministic mock RNG returning 0, 0.1, 0.2, 0.3, 0.4
    let val = 0;
    const mockRng = () => {
      const current = val;
      val += 0.05;
      return current;
    };

    const code1 = createRoomCode(mockRng);
    val = 0;
    const code2 = createRoomCode(mockRng);
    assert.equal(code1, code2);
    assert.equal(code1.length, 5);
  });

  it('throws TypeError if rng is not a function', () => {
    assert.throws(() => createRoomCode(null), { name: 'TypeError' });
    assert.throws(() => createRoomCode('not-a-fn'), { name: 'TypeError' });
  });
});

describe('RoomStore - createRoom', () => {
  it('creates a room with status lobby, host seated, and game null', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'HostPlayer' });

    assert.ok(room.code);
    assert.equal(room.code.length, 5);
    assert.equal(room.hostId, 'p1');
    assert.equal(room.status, 'lobby');
    assert.equal(room.game, null);
    assert.equal(room.players.length, 1);
    assert.deepEqual(room.players[0], {
      id: 'p1',
      name: 'HostPlayer',
      connected: true,
      joinedAt: room.createdAt,
    });
    assert.equal(store.getRoom(room.code), room);
  });

  it('rejects invalid host name with NAME_INVALID', () => {
    const store = new RoomStore();
    assert.throws(
      () => store.createRoom({ hostPlayerId: 'p1', hostName: '' }),
      (err) => err instanceof RoomError && err.code === 'NAME_INVALID'
    );
    assert.throws(
      () => store.createRoom({ hostPlayerId: 'p1', hostName: '   ' }),
      (err) => err instanceof RoomError && err.code === 'NAME_INVALID'
    );
    assert.throws(
      () => store.createRoom({ hostPlayerId: 'p1', hostName: 'A'.repeat(17) }),
      (err) => err instanceof RoomError && err.code === 'NAME_INVALID'
    );
  });

  it('regenerates code if initial code collides with an existing room', () => {
    let callCount = 0;
    // Returns 0 for first 5 calls (code "AAAAA"), then 0.5 for subsequent calls
    const mockRng = () => {
      callCount++;
      return callCount <= 5 ? 0 : 0.5;
    };

    const store = new RoomStore();
    // Pre-occupy first code
    const firstCode = createRoomCode(() => 0);
    store.rooms.set(firstCode, { code: firstCode });

    const newRoom = store.createRoom({ hostPlayerId: 'p1', hostName: 'HostPlayer', rng: mockRng });
    assert.notEqual(newRoom.code, firstCode);
    assert.equal(store.getRoom(newRoom.code), newRoom);
  });
});

describe('RoomStore - joinRoom', () => {
  it('adds player to lobby with connected: true and appended seat order', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'HostPlayer' });

    store.joinRoom(room.code, { playerId: 'p2', name: 'Player Two' });
    assert.equal(room.players.length, 2);
    assert.equal(room.players[1].id, 'p2');
    assert.equal(room.players[1].name, 'Player Two');
    assert.equal(room.players[1].connected, true);
    assert.ok(typeof room.players[1].joinedAt === 'number');
  });

  it('allows duplicate display names across different playerIds (Decision D9)', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'SameName' });

    store.joinRoom(room.code, { playerId: 'p2', name: 'SameName' });
    assert.equal(room.players.length, 2);
    assert.equal(room.players[0].name, 'SameName');
    assert.equal(room.players[1].name, 'SameName');
    assert.equal(room.players[0].id, 'p1');
    assert.equal(room.players[1].id, 'p2');
  });

  it('updates name and connection if existing player joins again', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'InitialName' });
    store.markDisconnected(room.code, 'p1');
    assert.equal(room.players[0].connected, false);

    store.joinRoom(room.code, { playerId: 'p1', name: 'UpdatedName' });
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].name, 'UpdatedName');
    assert.equal(room.players[0].connected, true);
  });

  it('rejects invalid name with NAME_INVALID', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'HostPlayer' });

    assert.throws(
      () => store.joinRoom(room.code, { playerId: 'p2', name: '  ' }),
      (err) => err instanceof RoomError && err.code === 'NAME_INVALID'
    );
    assert.throws(
      () => store.joinRoom(room.code, { playerId: 'p2', name: 'A'.repeat(17) }),
      (err) => err instanceof RoomError && err.code === 'NAME_INVALID'
    );
  });

  it('rejects non-existent room with ROOM_NOT_FOUND', () => {
    const store = new RoomStore();
    assert.throws(
      () => store.joinRoom('NONEX', { playerId: 'p2', name: 'Player' }),
      (err) => err instanceof RoomError && err.code === 'ROOM_NOT_FOUND'
    );
  });

  it('rejects joining when room status is playing (Decision D6)', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'HostPlayer' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'Player2' });
    store.startGame(room.code, 'p1');
    assert.equal(room.status, 'playing');

    assert.throws(
      () => store.joinRoom(room.code, { playerId: 'p3', name: 'Player3' }),
      (err) => err instanceof RoomError && err.code === 'ROOM_PLAYING'
    );
  });

  it('rejects joining when room is full at 6 players with ROOM_FULL', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'P1' });
    for (let i = 2; i <= 6; i++) {
      store.joinRoom(room.code, { playerId: `p${i}`, name: `P${i}` });
    }
    assert.equal(room.players.length, 6);

    assert.throws(
      () => store.joinRoom(room.code, { playerId: 'p7', name: 'P7' }),
      (err) => err instanceof RoomError && err.code === 'ROOM_FULL'
    );
  });

  it('allows joining when room is finished (Section 5.3)', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'p1', hostName: 'P1' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });
    store.startGame(room.code, 'p1');
    room.status = 'finished';

    store.joinRoom(room.code, { playerId: 'p3', name: 'P3' });
    assert.equal(room.players.length, 3);
    assert.equal(room.players[2].id, 'p3');
  });
});

describe('RoomStore - leaveRoom and transferHostIfNeeded', () => {
  it('transfers host to earliest joinedAt remaining player when host leaves (Decision D5)', () => {
    let mockTime = 1000;
    const store = new RoomStore({ now: () => mockTime });

    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    mockTime = 1010;
    store.joinRoom(room.code, { playerId: 'p2', name: 'Second' });
    mockTime = 1020;
    store.joinRoom(room.code, { playerId: 'p3', name: 'Third' });

    assert.equal(room.hostId, 'h1');
    store.leaveRoom(room.code, 'h1');

    assert.equal(room.players.length, 2);
    assert.equal(room.hostId, 'p2'); // Earliest joined remaining player
  });

  it('keeps existing host when a non-host player leaves', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'Second' });

    store.leaveRoom(room.code, 'p2');
    assert.equal(room.hostId, 'h1');
    assert.equal(room.players.length, 1);
  });

  it('sets hostId to null when last player leaves', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });

    store.leaveRoom(room.code, 'h1');
    assert.equal(room.players.length, 0);
    assert.equal(room.hostId, null);
  });

  it('throws NOT_IN_ROOM if leaving player is not in room', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });

    assert.throws(
      () => store.leaveRoom(room.code, 'non-existent'),
      (err) => err instanceof RoomError && err.code === 'NOT_IN_ROOM'
    );
  });

  it('standalone transferHostIfNeeded handles empty and unchanged rooms', () => {
    assert.equal(transferHostIfNeeded(null), null);
    assert.equal(transferHostIfNeeded({ players: [] }), null);

    const room = { hostId: 'h1', players: [{ id: 'h1', joinedAt: 100 }] };
    assert.equal(transferHostIfNeeded(room), 'h1');
  });
});

describe('RoomStore - startGame', () => {
  it('enforces NOT_HOST if caller is not the host', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });

    assert.throws(
      () => store.startGame(room.code, 'p2'),
      (err) => err instanceof RoomError && err.code === 'NOT_HOST'
    );
  });

  it('removes offline players before start and throws NEED_TWO_PLAYERS if under 2 remain', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });
    store.markDisconnected(room.code, 'p2');

    assert.throws(
      () => store.startGame(room.code, 'h1'),
      (err) => err instanceof RoomError && err.code === 'NEED_TWO_PLAYERS'
    );
    // Offline player was purged per section 5.6
    assert.equal(room.players.length, 1);
  });

  it('starts game, sets status to playing, and stores createGameFn result in room.game', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });
    store.joinRoom(room.code, { playerId: 'p3', name: 'P3' });

    let receivedPlayerIds = null;
    const fakeCreateGame = (orderedIds) => {
      receivedPlayerIds = orderedIds;
      return { fakeEngineState: true, playerCount: orderedIds.length };
    };

    store.startGame(room.code, 'h1', fakeCreateGame);

    assert.equal(room.status, 'playing');
    assert.deepEqual(receivedPlayerIds, ['h1', 'p2', 'p3']);
    assert.deepEqual(room.game, { fakeEngineState: true, playerCount: 3 });
  });

  it('supports startGame(room, createGameFn) shorthand signature', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });

    store.startGame(room, (ids) => ({ ids }));
    assert.equal(room.status, 'playing');
    assert.deepEqual(room.game, { ids: ['h1', 'p2'] });
  });
});

describe('RoomStore - rematch', () => {
  it('enforces NOT_HOST if caller is not the host', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });
    store.startGame(room.code, 'h1');
    room.status = 'finished';

    assert.throws(
      () => store.rematch(room.code, 'p2'),
      (err) => err instanceof RoomError && err.code === 'NOT_HOST'
    );
  });

  it('enforces status is finished before allowing rematch', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });

    assert.throws(
      () => store.rematch(room.code, 'h1'),
      (err) => err instanceof RoomError && err.code === 'INVALID_ACTION'
    );
  });

  it('removes offline players, keeps seat order, resets game to null and status to lobby', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });
    store.joinRoom(room.code, { playerId: 'p3', name: 'P3' });

    store.startGame(room.code, 'h1', () => ({ state: 'game1' }));
    room.status = 'finished';

    // Player 2 disconnects
    store.markDisconnected(room.code, 'p2');

    store.rematch(room.code, 'h1');

    assert.equal(room.status, 'lobby');
    assert.equal(room.game, null);
    // P2 removed; h1 and p3 preserved in original relative seat order
    assert.equal(room.players.length, 2);
    assert.equal(room.players[0].id, 'h1');
    assert.equal(room.players[1].id, 'p3');
    assert.equal(room.needsPlayers, false);
  });

  it('stays in lobby without throwing if under 2 players remain on rematch', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'P2' });

    store.startGame(room.code, 'h1', () => ({ state: 'game1' }));
    room.status = 'finished';

    // Only host remains connected
    store.markDisconnected(room.code, 'p2');

    store.rematch(room.code, 'h1');

    assert.equal(room.status, 'lobby');
    assert.equal(room.game, null);
    assert.equal(room.players.length, 1);
    assert.equal(room.needsPlayers, true);
  });
});

describe('RoomStore - markDisconnected & markReconnected', () => {
  it('toggles player connected state and updates lastActiveAt', () => {
    let time = 1000;
    const store = new RoomStore({ now: () => time });
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });

    time = 2000;
    store.markDisconnected(room.code, 'h1');
    assert.equal(room.players[0].connected, false);
    assert.equal(room.lastActiveAt, 2000);

    time = 3000;
    store.markReconnected(room.code, 'h1');
    assert.equal(room.players[0].connected, true);
    assert.equal(room.lastActiveAt, 3000);
  });

  it('throws NOT_IN_ROOM if player not in room', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });

    assert.throws(
      () => store.markDisconnected(room.code, 'unknown'),
      (err) => err instanceof RoomError && err.code === 'NOT_IN_ROOM'
    );
  });
});

describe('Concurrency and room serial queue', () => {
  it('serializes concurrent actions back-to-back without interleaving (Decision D11)', async () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    const timeline = [];

    // Queue task 1: simulates async work
    const action1 = room.enqueue(async () => {
      timeline.push('action1:start');
      await new Promise((resolve) => setImmediate(resolve));
      store.joinRoom(room.code, { playerId: 'p2', name: 'Player2' });
      timeline.push('action1:end');
      return 'res1';
    });

    // Queue task 2: fired back-to-back concurrently
    const action2 = room.enqueue(async () => {
      timeline.push('action2:start');
      store.joinRoom(room.code, { playerId: 'p3', name: 'Player3' });
      timeline.push('action2:end');
      return 'res2';
    });

    const [r1, r2] = await Promise.all([action1, action2]);
    assert.equal(r1, 'res1');
    assert.equal(r2, 'res2');

    // Assert strict serial execution order
    assert.deepEqual(timeline, [
      'action1:start',
      'action1:end',
      'action2:start',
      'action2:end',
    ]);

    // Both players joined without race conditions
    assert.equal(room.players.length, 3);
    assert.equal(room.players[1].id, 'p2');
    assert.equal(room.players[2].id, 'p3');
  });

  it('recovers and runs subsequent tasks even if a prior task in queue rejects', async () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });

    const failedTask = room.enqueue(async () => {
      throw new RoomError('SERVER_ERROR', 'Simulated failure');
    });

    const succeedingTask = room.enqueue(async () => {
      store.joinRoom(room.code, { playerId: 'p2', name: 'Player2' });
      return 'success';
    });

    await assert.rejects(failedTask, (err) => err.code === 'SERVER_ERROR');
    const result = await succeedingTask;
    assert.equal(result, 'success');
    assert.equal(room.players.length, 2);
  });

  it('withRoomQueue works standalone on room objects', async () => {
    const fakeRoom = { code: 'TEST1' };
    const res = await withRoomQueue(fakeRoom, () => 42);
    assert.equal(res, 42);
  });
});

describe('RoomStore - cleanupStaleRooms', () => {
  it('removes only rooms past the idle threshold with zero connections (D13, 7.4)', () => {
    let now = 1_000_000;
    const store = new RoomStore({ now: () => now });

    // Room 1: Active with connected players
    const r1 = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host1' });

    // Room 2: Zero connections, but active recently (< 10 minutes ago)
    const r2 = store.createRoom({ hostPlayerId: 'h2', hostName: 'Host2' });
    store.markDisconnected(r2.code, 'h2');

    // Room 3: Zero connections, inactive for 10+ minutes (600,000 ms)
    const r3 = store.createRoom({ hostPlayerId: 'h3', hostName: 'Host3' });
    store.markDisconnected(r3.code, 'h3');
    r3.lastActiveAt = now - 650_000;

    // Room 4: 10+ minutes inactive but still has a connected player
    const r4 = store.createRoom({ hostPlayerId: 'h4', hostName: 'Host4' });
    r4.lastActiveAt = now - 650_000;

    const removedCodes = store.cleanupStaleRooms(now);

    assert.deepEqual(removedCodes, [r3.code]);
    assert.ok(store.getRoom(r1.code));
    assert.ok(store.getRoom(r2.code));
    assert.equal(store.getRoom(r3.code), undefined);
    assert.ok(store.getRoom(r4.code));
  });
});

describe('DisconnectTimers', () => {
  it('fires onExpire after fake clock advances past 120s and NOT before', () => {
    const clock = createFakeClock();
    const timers = new DisconnectTimers(clock);

    let expired = false;
    timers.start('roomA:player1', () => {
      expired = true;
    }, 120_000);

    // Advance to 119,999 ms (1 ms before 120s)
    clock.advance(119_999);
    assert.equal(expired, false, 'Timer must not expire before 120s');
    assert.equal(timers.has('roomA:player1'), true);

    // Advance the remaining 1 ms (exactly 120,000 ms)
    clock.advance(1);
    assert.equal(expired, true, 'Timer must expire at 120s');
    assert.equal(timers.has('roomA:player1'), false);
  });

  it('cancel prevents expiry callback from being called', () => {
    const clock = createFakeClock();
    const timers = new DisconnectTimers(clock);

    let expired = false;
    timers.start('roomB:player1', () => {
      expired = true;
    }, 120_000);

    clock.advance(60_000);
    assert.equal(expired, false);

    const cancelled = timers.cancel('roomB:player1');
    assert.equal(cancelled, true);
    assert.equal(timers.has('roomB:player1'), false);

    // Advance clock past original 120s mark
    clock.advance(100_000);
    assert.equal(expired, false, 'Cancelled timer must never fire callback');
  });

  it('cancelAll cancels all active timers', () => {
    const clock = createFakeClock();
    const timers = new DisconnectTimers(clock);

    let count = 0;
    timers.start('key1', () => count++);
    timers.start('key2', () => count++);
    assert.equal(timers.size, 2);

    timers.cancelAll();
    assert.equal(timers.size, 0);

    clock.advance(200_000);
    assert.equal(count, 0);
  });
});

describe('toRoomState helper', () => {
  it('formats room according to rules.md section 6.5 contract', () => {
    const store = new RoomStore();
    const room = store.createRoom({ hostPlayerId: 'h1', hostName: 'Host' });
    store.joinRoom(room.code, { playerId: 'p2', name: 'Guest' });

    const state = toRoomState(room);
    assert.equal(state.code, room.code);
    assert.equal(state.hostId, 'h1');
    assert.equal(state.status, 'lobby');
    assert.deepEqual(state.players, [
      { id: 'h1', name: 'Host', connected: true, seat: 0 },
      { id: 'p2', name: 'Guest', connected: true, seat: 1 },
    ]);
  });
});
