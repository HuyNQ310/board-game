/**
 * @file server/rooms.mjs
 * Room model, lifecycle, in-memory store, host transfer, and concurrency serialization.
 * Implements specifications from rules.md (Decisions D5-D13, Section 5, Section 6.2).
 */

import { MAX_PLAYERS } from '../shared/engine.mjs';

/**
 * 5-character alphabet excluding 0, O, 1, I, L to avoid visual ambiguity (rules.md section 5.1).
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Custom error class carrying a string error code matching rules.md section 6.2.
 */
export class RoomError extends Error {
  /**
   * @param {string} code - Exact code string, e.g. 'ROOM_FULL', 'NOT_HOST'
   * @param {string} [message] - Human-readable explanation
   */
  constructor(code, message) {
    super(message || code);
    this.name = 'RoomError';
    this.code = code;
  }
}

/**
 * Generates a 5-character room code from the safe alphabet using an injected RNG function.
 * Purity requirement: Never calls Math.random directly inside the generation logic.
 *
 * @param {() => number} [rng=Math.random] - Function returning a float in [0, 1)
 * @returns {string} 5-character room code
 */
export function createRoomCode(rng = Math.random) {
  if (typeof rng !== 'function') {
    throw new TypeError('rng must be a function');
  }
  let code = '';
  for (let i = 0; i < 5; i++) {
    const val = rng();
    const index = Math.floor(val * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[Math.min(index, ROOM_CODE_ALPHABET.length - 1)];
  }
  return code;
}

/**
 * Serializes async and sync actions per room using an atomic Promise chain (Decision D11).
 *
 * Why this is needed and how it works:
 * In a multiplayer server, multiple socket events or timeout callbacks can target the same room
 * concurrently (e.g. two players joining simultaneously, or a host starting the game while someone
 * leaves). To prevent race conditions and corrupted room state, every mutating action on a room
 * must be strictly serialized.
 *
 * Each room maintains an internal promise chain (`room._queue`).
 * When an action is enqueued:
 * 1. It is attached via `.then()` to the tail of `room._queue`, waiting for the previous action to finish.
 * 2. It runs `fn()` atomically to completion (even if `fn()` is async).
 * 3. Even if `fn()` throws or rejects, `room._queue` recovers so subsequent tasks are not blocked.
 * 4. The caller receives a Promise that resolves with `fn()`'s return value or rejects with `fn()`'s error.
 *
 * @template T
 * @param {object} room - Room object
 * @param {() => Promise<T>|T} fn - Action callback
 * @returns {Promise<T>} Result of fn()
 */
export function withRoomQueue(room, fn) {
  if (!room) {
    return Promise.reject(new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng'));
  }
  if (typeof fn !== 'function') {
    return Promise.reject(new TypeError('fn must be a function'));
  }

  if (!room._queue) {
    room._queue = Promise.resolve();
  }

  // Wrap invocation so both sync throws and async rejections are captured in a Promise
  const executeTask = () => Promise.resolve().then(() => fn());

  // Chain off the previous promise tail regardless of whether it succeeded or failed
  const taskPromise = room._queue.then(executeTask, executeTask);

  // Advance the internal room queue tail, swallowing errors on the internal reference
  // so an error in task N does not trigger unhandledRejection or cancel task N+1.
  room._queue = taskPromise.then(
    () => {},
    () => {}
  );

  return taskPromise;
}

/**
 * Checks if the room host is still in the room. If not, promotes the remaining player
 * with the earliest `joinedAt` timestamp (Decision D5, Section 5.5).
 *
 * @param {object} room - Room object
 * @returns {string|null} Current or newly promoted hostId, or null if no players remain
 */
export function transferHostIfNeeded(room) {
  if (!room || !Array.isArray(room.players) || room.players.length === 0) {
    if (room) {
      room.hostId = null;
    }
    return null;
  }

  const hostPresent = room.players.some((p) => p.id === room.hostId);
  if (hostPresent) {
    return room.hostId;
  }

  // Host left: find remaining player with the earliest joinedAt
  let earliest = room.players[0];
  for (let i = 1; i < room.players.length; i++) {
    const p = room.players[i];
    if (p.joinedAt < earliest.joinedAt) {
      earliest = p;
    }
  }

  room.hostId = earliest.id;
  return room.hostId;
}

/**
 * Serializes the room object to the wire format specified in rules.md section 6.5.
 *
 * @param {object} room
 * @returns {object|null}
 */
export function toRoomState(room) {
  if (!room) return null;
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      seat: index,
    })),
  };
}

/**
 * In-memory room manager managing rooms keyed by room code.
 */
export class RoomStore {
  /**
   * @param {object} [options]
   * @param {() => number} [options.now] - Clock function returning milliseconds
   * @param {() => number} [options.rng] - Random number generator returning [0, 1)
   */
  constructor({ now = () => Date.now(), rng = Math.random } = {}) {
    this.rooms = new Map();
    this.now = now;
    this.rng = rng;
  }

  /**
   * @private
   */
  _normalizeCode(code) {
    if (typeof code === 'string') {
      return code.trim().toUpperCase();
    }
    return code;
  }

  /**
   * @private
   */
  _resolveRoom(codeOrRoom) {
    if (codeOrRoom && typeof codeOrRoom === 'object' && codeOrRoom.code) {
      return codeOrRoom;
    }
    return this.getRoom(codeOrRoom);
  }

  /**
   * Creates a new room with status 'lobby' and the host as the first seated player.
   * Checks collisions to ensure code uniqueness.
   *
   * @param {object} params
   * @param {string} params.hostPlayerId - Unique ID of the creating player
   * @param {string} params.hostName - Display name (1-16 chars after trim)
   * @param {() => number} [params.rng] - Optional RNG function
   * @returns {object} The created room
   */
  createRoom({ hostPlayerId, hostName, rng = this.rng }) {
    if (!hostPlayerId || typeof hostPlayerId !== 'string') {
      throw new RoomError('INVALID_ACTION', 'hostPlayerId is required');
    }
    if (!hostName || typeof hostName !== 'string') {
      throw new RoomError('NAME_INVALID', 'Tên phải từ 1 đến 16 ký tự');
    }
    const trimmedName = hostName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 16) {
      throw new RoomError('NAME_INVALID', 'Tên phải từ 1 đến 16 ký tự');
    }

    let code = createRoomCode(rng);
    let attempts = 0;
    while (this.rooms.has(code)) {
      attempts++;
      if (attempts > 10000) {
        throw new RoomError('SERVER_ERROR', 'Không thể tạo mã phòng duy nhất');
      }
      code = createRoomCode(rng);
    }

    const nowMs = this.now();
    const hostPlayer = {
      id: hostPlayerId,
      name: trimmedName,
      connected: true,
      joinedAt: nowMs,
    };

    const room = {
      code,
      hostId: hostPlayerId,
      status: 'lobby',
      players: [hostPlayer],
      game: null,
      createdAt: nowMs,
      lastActiveAt: nowMs,
      enqueue(fn) {
        return withRoomQueue(this, fn);
      },
    };

    this.rooms.set(code, room);
    return room;
  }

  /**
   * Gets a room by code (case-insensitive).
   *
   * @param {string} code
   * @returns {object|undefined}
   */
  getRoom(code) {
    if (!code) return undefined;
    const normalized = this._normalizeCode(code);
    return this.rooms.get(normalized);
  }

  /**
   * Joins a player to the room.
   * Enforces:
   * - Trimmed name length 1-16 -> NAME_INVALID
   * - Room not found -> ROOM_NOT_FOUND
   * - Status 'playing' -> ROOM_PLAYING
   * - Room full (>= MAX_PLAYERS players) -> ROOM_FULL
   * - Appends player with connected: true, joinedAt, keeps seat order.
   *
   * @param {string|object} codeOrRoom
   * @param {object} params
   * @param {string} params.playerId
   * @param {string} params.name
   * @returns {object} The updated room
   */
  joinRoom(codeOrRoom, { playerId, name }) {
    if (!name || typeof name !== 'string') {
      throw new RoomError('NAME_INVALID', 'Tên phải từ 1 đến 16 ký tự');
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 16) {
      throw new RoomError('NAME_INVALID', 'Tên phải từ 1 đến 16 ký tự');
    }
    if (!playerId || typeof playerId !== 'string') {
      throw new RoomError('INVALID_ACTION', 'playerId is required');
    }

    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    if (room.status === 'playing') {
      throw new RoomError('ROOM_PLAYING', 'Phòng đang chơi, không thể vào lúc này');
    }

    // If player is already in room, reconnect and update name
    const existingIndex = room.players.findIndex((p) => p.id === playerId);
    if (existingIndex !== -1) {
      room.players[existingIndex].connected = true;
      room.players[existingIndex].name = trimmedName;
      room.lastActiveAt = this.now();
      return room;
    }

    // Capacity limit: max MAX_PLAYERS players (rules.md section 5.1, extended
    // per owner request from the original 6-player cap; shared/engine.mjs's
    // buildOrdinaryDeck scales the deck proportionally for n > 6).
    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError('ROOM_FULL', `Phòng đã đủ ${MAX_PLAYERS} người`);
    }

    const nowMs = this.now();
    const player = {
      id: playerId,
      name: trimmedName,
      connected: true,
      joinedAt: nowMs,
    };

    room.players.push(player);
    room.lastActiveAt = nowMs;
    return room;
  }

  /**
   * Removes a player from the room and re-evaluates host leadership (Decision D5).
   *
   * @param {string|object} codeOrRoom
   * @param {string} playerId
   * @returns {object} The updated room
   */
  leaveRoom(codeOrRoom, playerId) {
    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    const index = room.players.findIndex((p) => p.id === playerId);
    if (index === -1) {
      throw new RoomError('NOT_IN_ROOM', 'Bạn không còn trong phòng này');
    }

    room.players.splice(index, 1);
    this.transferHostIfNeeded(room);
    room.lastActiveAt = this.now();
    return room;
  }

  /**
   * Starts a game from the lobby (Section 5.6).
   * - Enforces caller is host -> NOT_HOST
   * - Removes offline players first
   * - Enforces at least 2 connected players -> NEED_TWO_PLAYERS
   * - Sets status to 'playing'
   * - Calls createGameFn(orderedPlayerIds) and stores result as room.game
   *
   * @param {string|object} codeOrRoom
   * @param {string|Function} hostPlayerId
   * @param {Function} [createGameFn]
   * @returns {object} The updated room
   */
  startGame(codeOrRoom, hostPlayerId, createGameFn) {
    const room = this._resolveRoom(codeOrRoom);
    let actualHostId = hostPlayerId;
    let actualCreateGameFn = createGameFn;

    // Support startGame(room, createGameFn) signature
    if (typeof hostPlayerId === 'function' && createGameFn === undefined) {
      actualCreateGameFn = hostPlayerId;
      actualHostId = room?.hostId;
    }

    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    if (actualHostId !== undefined && room.hostId !== actualHostId) {
      throw new RoomError('NOT_HOST', 'Chỉ chủ phòng mới làm được việc này');
    }

    if (room.status === 'playing') {
      throw new RoomError('ROOM_PLAYING', 'Phòng đang chơi, không thể vào lúc này');
    }

    // Section 5.6: remove offline players first
    room.players = room.players.filter((p) => p.connected);
    this.transferHostIfNeeded(room);

    if (room.players.length < 2) {
      throw new RoomError('NEED_TWO_PLAYERS', 'Cần ít nhất 2 người đang kết nối để bắt đầu');
    }

    const orderedPlayerIds = room.players.map((p) => p.id);
    room.status = 'playing';
    room.game = typeof actualCreateGameFn === 'function' ? actualCreateGameFn(orderedPlayerIds) : null;
    room.lastActiveAt = this.now();
    return room;
  }

  /**
   * Starts a rematch from 'finished' state (Decision D10, Section 5.7).
   * - Enforces caller is host -> NOT_HOST
   * - Enforces status is 'finished' -> INVALID_ACTION
   * - Removes offline players, keeps seat order
   * - Sets game = null, status = 'lobby'
   * - If < 2 players remain, stays in lobby without error and sets needsPlayers = true
   *
   * @param {string|object} codeOrRoom
   * @param {string} [hostPlayerId]
   * @returns {object} The updated room
   */
  rematch(codeOrRoom, hostPlayerId) {
    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    const actualHostId = hostPlayerId || room.hostId;
    if (room.hostId !== actualHostId) {
      throw new RoomError('NOT_HOST', 'Chỉ chủ phòng mới làm được việc này');
    }

    if (room.status !== 'finished') {
      throw new RoomError('INVALID_ACTION', 'Chỉ có thể chơi lại khi ván đã kết thúc');
    }

    // Remove offline players, keep existing seat order
    room.players = room.players.filter((p) => p.connected);
    this.transferHostIfNeeded(room);

    room.game = null;
    room.status = 'lobby';
    room.needsPlayers = room.players.length < 2;
    room.lastActiveAt = this.now();

    return room;
  }

  /**
   * Marks a player as disconnected without modifying timers (Section 5.4).
   *
   * @param {string|object} codeOrRoom
   * @param {string} playerId
   * @returns {object} The updated room
   */
  markDisconnected(codeOrRoom, playerId) {
    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new RoomError('NOT_IN_ROOM', 'Bạn không còn trong phòng này');
    }

    player.connected = false;
    room.lastActiveAt = this.now();
    return room;
  }

  /**
   * Marks a player as reconnected without modifying timers (Section 5.4).
   *
   * @param {string|object} codeOrRoom
   * @param {string} playerId
   * @returns {object} The updated room
   */
  markReconnected(codeOrRoom, playerId) {
    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new RoomError('NOT_IN_ROOM', 'Bạn không còn trong phòng này');
    }

    player.connected = true;
    room.lastActiveAt = this.now();
    return room;
  }

  /**
   * Helper to transfer host on a room if needed.
   *
   * @param {object} room
   * @returns {string|null}
   */
  transferHostIfNeeded(room) {
    return transferHostIfNeeded(room);
  }

  /**
   * Removes rooms with zero connected players and lastActiveAt older than idleMs (D13, 7.4).
   *
   * @param {number} [nowMs] - Current timestamp in ms
   * @param {number} [idleMs=600000] - Inactivity duration threshold (default 10 mins = 600,000 ms)
   * @returns {string[]} Array of removed room codes
   */
  cleanupStaleRooms(nowMs, idleMs = 10 * 60 * 1000) {
    const currentTime = nowMs !== undefined ? nowMs : this.now();
    const removedCodes = [];

    for (const [code, room] of this.rooms.entries()) {
      const connectedCount = room.players.filter((p) => p.connected).length;
      const isIdle = currentTime - room.lastActiveAt >= idleMs;

      if (connectedCount === 0 && isIdle) {
        this.rooms.delete(code);
        removedCodes.push(code);
      }
    }

    return removedCodes;
  }

  /**
   * Queues an atomic operation on the given room's serial queue.
   *
   * @template T
   * @param {string|object} codeOrRoom
   * @param {() => Promise<T>|T} fn
   * @returns {Promise<T>}
   */
  enqueue(codeOrRoom, fn) {
    const room = this._resolveRoom(codeOrRoom);
    if (!room) {
      return Promise.reject(new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng'));
    }
    return withRoomQueue(room, fn);
  }
}
