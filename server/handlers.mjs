/**
 * Mèo Nổ — Server Socket Event Handlers (ES Module)
 *
 * Implements section 1 (D11, D12), section 5 (lifecycle), section 6 (socket contract),
 * and section 7 (server processing) of rules.md.
 * Pure module with dependency injection: zero direct imports of express/socket.io/rooms/engine/errors.
 */

export const ERROR_MESSAGES = Object.freeze({
  NAME_INVALID: 'Tên phải từ 1 đến 16 ký tự',
  ROOM_NOT_FOUND: 'Không tìm thấy phòng',
  ROOM_FULL: 'Phòng đã đủ 10 người',
  ROOM_PLAYING: 'Phòng đang chơi, không thể vào lúc này',
  NOT_IN_ROOM: 'Bạn không còn trong phòng này',
  NOT_HOST: 'Chỉ chủ phòng mới làm được việc này',
  NEED_TWO_PLAYERS: 'Cần ít nhất 2 người đang kết nối để bắt đầu',
  NOT_YOUR_TURN: 'Chưa đến lượt bạn',
  DEFUSE_PENDING: 'Bạn đang phải gỡ bom',
  NO_CARD: 'Không có lá này trong tay',
  INVALID_CARD: 'Lá này không thể đánh riêng',
  INVALID_TARGET: 'Mục tiêu không hợp lệ',
  INVALID_ACTION: 'Hành động không hợp lệ',
  GAME_OVER: 'Ván đã kết thúc',
  RATE_LIMIT: 'Thao tác quá nhanh, thử lại sau chút',
  SERVER_ERROR: 'Có lỗi xảy ra, vui lòng thử lại',
});

export const PLAYABLE_CARDS = Object.freeze(['skip', 'attack', 'reverse', 'shuffle', 'peek', 'favor']);
export const CAT_CARDS = Object.freeze(['cat', 'taco', 'potato']);

/**
 * Sliding-window rate limiter keyed by socket id (D12 / 7.2).
 * Default limit: 10 events per 1-second window.
 */
export function createRateLimiter({ max = 10, windowMs = 1000, now = Date.now } = {}) {
  const store = new Map();

  return {
    consume(socketId) {
      if (!socketId) return true;
      const currentTime = now();
      const cutoff = currentTime - windowMs;
      let timestamps = store.get(socketId);

      if (!timestamps) {
        store.set(socketId, [currentTime]);
        return true;
      }

      timestamps = timestamps.filter(t => t > cutoff);
      if (timestamps.length >= max) {
        store.set(socketId, timestamps);
        return false;
      }

      timestamps.push(currentTime);
      store.set(socketId, timestamps);
      return true;
    },
    reset(socketId) {
      if (socketId) {
        store.delete(socketId);
      } else {
        store.clear();
      }
    },
    get(socketId) {
      const timestamps = store.get(socketId);
      if (!timestamps) return 0;
      const cutoff = now() - windowMs;
      return timestamps.filter(t => t > cutoff).length;
    },
  };
}

/**
 * Per-room serial promise queue (D11 / 7.1).
 * Guarantees that actions within a room run sequentially and atomically.
 */
export class RoomQueue {
  constructor() {
    this.queues = new Map();
  }

  run(roomCode, task) {
    if (!roomCode) {
      return Promise.resolve().then(task);
    }
    const currentQueue = this.queues.get(roomCode) || Promise.resolve();
    const nextQueue = currentQueue
      .catch(() => {})
      .then(task);

    this.queues.set(roomCode, nextQueue);
    nextQueue
      .finally(() => {
        if (this.queues.get(roomCode) === nextQueue) {
          this.queues.delete(roomCode);
        }
      })
      .catch(() => {});

    return nextQueue;
  }
}

/**
 * Helper to safely invoke a roomStore method whether it accepts positional or object arguments.
 */
async function invokeRoomStore(fn, posArgs = [], objArg = null) {
  if (typeof fn !== 'function') return null;
  if (fn.length === 1 && posArgs.length > 1 && objArg) {
    try {
      return await fn(objArg);
    } catch (e) {
      if (e && e.code) throw e;
      return await fn(...posArgs);
    }
  }
  try {
    return await fn(...posArgs);
  } catch (e) {
    if (e && e.code) throw e;
    if (objArg && (e instanceof TypeError || e?.message?.includes('destruct') || e?.message?.includes('undefined'))) {
      return await fn(objArg);
    }
    throw e;
  }
}

/**
 * Validates payload shape for game:action before reaching the engine.
 */
export function validateGameActionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'INVALID_ACTION' };
  }

  const { type, card, target, insertAt } = payload;
  if (typeof type !== 'string') {
    return { ok: false, code: 'INVALID_ACTION' };
  }

  if (type === 'draw') {
    return { ok: true, action: { type: 'draw' } };
  }

  if (type === 'play') {
    if (card === 'nope') {
      return { ok: true, action: { type: 'nope' } };
    }
    if (!card || typeof card !== 'string' || !PLAYABLE_CARDS.includes(card)) {
      return { ok: false, code: 'INVALID_ACTION' };
    }
    if (card === 'favor') {
      if (!target || typeof target !== 'string' || !target.trim()) {
        return { ok: false, code: 'INVALID_TARGET' };
      }
      return { ok: true, action: { type: 'play', card, target: target.trim() } };
    }
    if (target !== undefined) {
      if (typeof target !== 'string' || !target.trim()) {
        return { ok: false, code: 'INVALID_TARGET' };
      }
      return { ok: true, action: { type: 'play', card, target: target.trim() } };
    }
    return { ok: true, action: { type: 'play', card } };
  }

  if (type === 'catPair') {
    if (!target || typeof target !== 'string' || !target.trim()) {
      return { ok: false, code: 'INVALID_TARGET' };
    }
    if (card !== undefined) {
      if (typeof card !== 'string' || !CAT_CARDS.includes(card)) {
        return { ok: false, code: 'INVALID_ACTION' };
      }
      return { ok: true, action: { type: 'catPair', card, target: target.trim() } };
    }
    return { ok: true, action: { type: 'catPair', target: target.trim() } };
  }

  if (type === 'nope') {
    return { ok: true, action: { type: 'nope' } };
  }

  if (type === 'passNope') {
    return { ok: true, action: { type: 'passNope' } };
  }

  if (type === 'defuse') {
    if (insertAt === undefined || typeof insertAt !== 'number' || Number.isNaN(insertAt)) {
      return { ok: false, code: 'INVALID_ACTION' };
    }
    return { ok: true, action: { type: 'defuse', insertAt: Math.floor(insertAt) } };
  }

  return { ok: false, code: 'INVALID_ACTION' };
}

function isValidName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 16;
}

function createSafeAck(ack) {
  let called = false;
  return (res) => {
    if (called) return;
    called = true;
    if (typeof ack === 'function') {
      try {
        ack(res);
      } catch {
        // do not let ack exceptions break execution
      }
    }
  };
}

function createErrorAckFormatter(toErrorAck, mapGameErrorToCode) {
  return (errOrCode) => {
    let code = 'SERVER_ERROR';
    if (typeof errOrCode === 'string') {
      code = errOrCode;
    } else if (errOrCode && typeof errOrCode.code === 'string') {
      code = errOrCode.code;
    } else if (typeof mapGameErrorToCode === 'function') {
      try {
        const mapped = mapGameErrorToCode(errOrCode);
        if (typeof mapped === 'string' && mapped) {
          code = mapped;
        }
      } catch {}
    }

    if (typeof toErrorAck === 'function') {
      try {
        const customAck = toErrorAck(code);
        if (customAck && typeof customAck === 'object') {
          return customAck;
        }
      } catch {}
    }

    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.SERVER_ERROR;
    return { ok: false, code, message };
  };
}

/**
 * Creates socket event handlers keyed by event name from rules.md section 6.3.
 *
 * @param {object} [arg1] Options object or `io` instance
 * @param {object} [arg2] Options object if `arg1` was `io`
 * @returns {Record<string, (socket: object, payload: any, ack: function) => Promise<void>>}
 */
export function createHandlers(arg1 = {}, arg2 = {}) {
  let io = null;
  let options = {};
  if (arg1 && (arg1.roomStore || arg1.engine || arg1.toErrorAck || arg1.broadcastState || arg1.mapGameErrorToCode)) {
    options = arg1;
    io = options.io || null;
  } else if (arg2 && typeof arg2 === 'object') {
    io = arg1;
    options = arg2;
  } else {
    options = arg1 || {};
  }

  const {
    roomStore = {},
    mapGameErrorToCode,
    toErrorAck,
    engine,
    rng = Math.random,
    now = Date.now,
  } = options;

  const broadcastState = options.broadcastState || (io && typeof io.to === 'function' ? (room) => {
    io.to(room.code).emit('room:state', room);
  } : null);

  const replaceSession = options.replaceSession || (io ? (oldSocketId) => {
    if (typeof io.to === 'function') {
      io.to(oldSocketId).emit('session:replaced', {});
    }
    const oldSock = io.sockets?.sockets?.get ? io.sockets.sockets.get(oldSocketId) : null;
    if (oldSock && typeof oldSock.disconnect === 'function') {
      oldSock.disconnect(true);
    }
  } : null);

  const rateLimiter = options.rateLimiter || createRateLimiter({ now });
  const roomQueue = options.roomQueue || new RoomQueue();
  const toErrAck = createErrorAckFormatter(toErrorAck, mapGameErrorToCode);

  return {
    'room:create': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const playerId = payload?.playerId;
        const rawName = payload?.name;

        if (!playerId || typeof playerId !== 'string') {
          safeAck(toErrAck('INVALID_ACTION'));
          return;
        }
        if (!isValidName(rawName)) {
          safeAck(toErrAck('NAME_INVALID'));
          return;
        }

        const name = rawName.trim();
        const room = await invokeRoomStore(
          roomStore.createRoom.bind(roomStore),
          [{ hostPlayerId: playerId, hostName: name }],
          { hostPlayerId: playerId, hostName: name }
        );

        if (!room || !room.code) {
          safeAck(toErrAck('SERVER_ERROR'));
          return;
        }

        if (socket) {
          socket.playerId = playerId;
          socket.roomCode = room.code;
          if (!socket.data) socket.data = {};
          socket.data.playerId = playerId;
          socket.data.roomCode = room.code;
          if (typeof socket.join === 'function') {
            socket.join(room.code);
            socket.join(playerId);
          }
        }

        if (typeof broadcastState === 'function') {
          await broadcastState(room);
        }

        safeAck({ ok: true, code: room.code });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'room:join': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const playerId = payload?.playerId;
        const rawName = payload?.name;
        const rawCode = payload?.code;

        if (!playerId || typeof playerId !== 'string') {
          safeAck(toErrAck('INVALID_ACTION'));
          return;
        }
        if (!isValidName(rawName)) {
          safeAck(toErrAck('NAME_INVALID'));
          return;
        }
        if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
          safeAck(toErrAck('ROOM_NOT_FOUND'));
          return;
        }

        const name = rawName.trim();
        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          const room = await invokeRoomStore(
            roomStore.joinRoom.bind(roomStore),
            [code, { playerId, name }],
            { code, playerId, name, socketId }
          );

          if (!room || !room.code) {
            safeAck(toErrAck('ROOM_NOT_FOUND'));
            return;
          }

          if (socket) {
            socket.playerId = playerId;
            socket.roomCode = room.code;
            if (!socket.data) socket.data = {};
            socket.data.playerId = playerId;
            socket.data.roomCode = room.code;
            if (typeof socket.join === 'function') {
              socket.join(room.code);
              socket.join(playerId);
            }
          }

          if (typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          safeAck({ ok: true, code: room.code });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'room:resume': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      // NOTE: room:resume is excluded from rate limiting per rules.md D12/7.2

      try {
        const playerId = payload?.playerId;
        const rawCode = payload?.code;

        if (!playerId || typeof playerId !== 'string' || !rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
          safeAck(toErrAck('ROOM_NOT_FOUND'));
          return;
        }

        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          let oldSocketId = null;
          if (typeof roomStore.getRoom === 'function') {
            try {
              const prev = await invokeRoomStore(roomStore.getRoom.bind(roomStore), [code], { code });
              const prevPlayer = prev?.players?.find(p => p.id === playerId);
              if (prevPlayer?.socketId) {
                oldSocketId = prevPlayer.socketId;
              }
            } catch {}
          }

          const res = await invokeRoomStore(
            roomStore.markReconnected.bind(roomStore),
            [code, playerId, socket?.id],
            { code, playerId, socketId: socket?.id }
          );

          const room = res?.room || res;
          if (!room || !room.code) {
            safeAck(toErrAck('ROOM_NOT_FOUND'));
            return;
          }

          if (res?.oldSocketId) {
            oldSocketId = res.oldSocketId;
          }

          if (oldSocketId && socket?.id && oldSocketId !== socket.id && typeof replaceSession === 'function') {
            try {
              await replaceSession(oldSocketId);
            } catch {}
          }

          if (socket) {
            socket.playerId = playerId;
            socket.roomCode = room.code;
            if (!socket.data) socket.data = {};
            socket.data.playerId = playerId;
            socket.data.roomCode = room.code;
            if (typeof socket.join === 'function') {
              socket.join(room.code);
              socket.join(playerId);
            }
          }

          if (typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          let gameState = null;
          if (room.game) {
            const view = (typeof engine?.viewFor === 'function')
              ? engine.viewFor(room.game, playerId)
              : room.game;
            const turnDeadline = room._turnTimerState?.deadline ?? null;
            gameState = turnDeadline
              ? { ...view, turnDeadline, serverNow: Date.now() }
              : view;
          }

          const roomPayload = { ...room };
          delete roomPayload.game;
          safeAck({
            ok: true,
            code: room.code,
            room: roomPayload,
            game: gameState,
          });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'room:leave': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const playerId = socket?.data?.playerId ?? socket?.playerId ?? payload?.playerId;
        const rawCode = socket?.data?.roomCode ?? socket?.roomCode ?? payload?.roomCode ?? payload?.code;

        if (!playerId || !rawCode || typeof rawCode !== 'string') {
          safeAck(toErrAck('NOT_IN_ROOM'));
          return;
        }

        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          const room = await invokeRoomStore(
            roomStore.leaveRoom.bind(roomStore),
            [code, playerId],
            { code, playerId }
          );

          if (room && room.status === 'playing' && room.game && typeof engine?.eliminatePlayer === 'function') {
            room.game = engine.eliminatePlayer(room.game, playerId, 'disconnect', rng);
            if (
              room.game?.phase === 'nope' &&
              typeof engine.hasEligibleNopeHolder === 'function' &&
              !engine.hasEligibleNopeHolder(room.game)
            ) {
              room.game =
                typeof engine.resolvePendingAction === 'function'
                  ? engine.resolvePendingAction(room.game, rng)
                  : engine.applyAction(room.game, room.game.currentPlayerId, { type: 'resolveNope' }, rng);
            }
            if (
              room.game?.phase === 'over' ||
              (room.game?.winnerId !== undefined && room.game?.winnerId !== null)
            ) {
              room.status = 'finished';
            }
          }

          if (socket) {
            if (typeof socket.leave === 'function') {
              socket.leave(code);
            }
            delete socket.playerId;
            delete socket.roomCode;
            if (socket.data) {
              delete socket.data.playerId;
              delete socket.data.roomCode;
            }
          }

          if (room && typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          safeAck({ ok: true });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'game:start': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const playerId = socket?.data?.playerId ?? socket?.playerId ?? payload?.playerId;
        const rawCode = socket?.data?.roomCode ?? socket?.roomCode ?? payload?.roomCode ?? payload?.code;

        if (!playerId || !rawCode || typeof rawCode !== 'string') {
          safeAck(toErrAck('NOT_IN_ROOM'));
          return;
        }

        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          const room = await invokeRoomStore(
            roomStore.startGame.bind(roomStore),
            [code, playerId],
            { code, playerId }
          );

          if (!room) {
            safeAck(toErrAck('ROOM_NOT_FOUND'));
            return;
          }

          if (!room.game && typeof engine?.createGame === 'function') {
            // Pass {id, name} objects, not bare id strings -- engine.createGame
            // falls back to using the id itself as the display name when given
            // a plain string (see shared/engine.mjs normalizePlayers), which is
            // exactly how player names ended up showing as raw UUIDs in-game.
            const activePlayers = room.players
              ? room.players.filter(p => p.connected !== false).map(p => ({ id: p.id, name: p.name }))
              : [];
            room.game = engine.createGame(activePlayers, rng);
            room.status = 'playing';
          }

          if (typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          safeAck({ ok: true });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'game:action': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const validation = validateGameActionPayload(payload);
        if (!validation.ok) {
          safeAck(toErrAck(validation.code));
          return;
        }

        const playerId = socket?.data?.playerId ?? socket?.playerId ?? payload?.playerId;
        const rawCode = socket?.data?.roomCode ?? socket?.roomCode ?? payload?.roomCode ?? payload?.code;

        if (!playerId || !rawCode || typeof rawCode !== 'string') {
          safeAck(toErrAck('NOT_IN_ROOM'));
          return;
        }

        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          const room = await invokeRoomStore(roomStore.getRoom.bind(roomStore), [code], { code });
          if (!room) {
            safeAck(toErrAck('ROOM_NOT_FOUND'));
            return;
          }

          const player = room.players?.find(p => p.id === playerId);
          if (!player) {
            safeAck(toErrAck('NOT_IN_ROOM'));
            return;
          }

          if (room.status === 'finished') {
            safeAck(toErrAck('GAME_OVER'));
            return;
          }

          if (room.status !== 'playing' || !room.game) {
            safeAck(toErrAck('INVALID_ACTION'));
            return;
          }

          if (!engine || typeof engine.applyAction !== 'function') {
            safeAck(toErrAck('SERVER_ERROR'));
            return;
          }

          let nextGame;
          try {
            nextGame = await engine.applyAction(room.game, playerId, validation.action, rng);
            if (
              nextGame?.phase === 'nope' &&
              typeof engine.hasEligibleNopeHolder === 'function' &&
              !engine.hasEligibleNopeHolder(nextGame)
            ) {
              if (typeof engine.resolvePendingAction === 'function') {
                nextGame = await engine.resolvePendingAction(nextGame, rng);
              } else {
                nextGame = await engine.applyAction(nextGame, nextGame.currentPlayerId, { type: 'resolveNope' }, rng);
              }
            }
          } catch (gameErr) {
            const errorAck = toErrAck(gameErr);
            if (socket && typeof socket.emit === 'function') {
              socket.emit('game:error', { code: errorAck.code, message: errorAck.message });
            }
            safeAck(errorAck);
            return;
          }

          room.game = nextGame || room.game;
          if (room.game?.phase === 'over') {
            room.status = 'finished';
          }

          if (typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          safeAck({ ok: true });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },

    'room:rematch': async (socket, payload, ack) => {
      const safeAck = createSafeAck(ack);
      const socketId = socket?.id || 'unknown';

      if (!rateLimiter.consume(socketId)) {
        safeAck(toErrAck('RATE_LIMIT'));
        return;
      }

      try {
        const playerId = socket?.data?.playerId ?? socket?.playerId ?? payload?.playerId;
        const rawCode = socket?.data?.roomCode ?? socket?.roomCode ?? payload?.roomCode ?? payload?.code;

        if (!playerId || !rawCode || typeof rawCode !== 'string') {
          safeAck(toErrAck('NOT_IN_ROOM'));
          return;
        }

        const code = rawCode.trim().toUpperCase();

        await roomQueue.run(code, async () => {
          const room = await invokeRoomStore(
            roomStore.rematch.bind(roomStore),
            [code, playerId],
            { code, playerId }
          );

          if (!room) {
            safeAck(toErrAck('ROOM_NOT_FOUND'));
            return;
          }

          room.game = null;
          room.status = 'lobby';

          if (typeof broadcastState === 'function') {
            await broadcastState(room);
          }

          safeAck({ ok: true });
        });
      } catch (err) {
        safeAck(toErrAck(err));
      }
    },
  };
}

export default createHandlers;
