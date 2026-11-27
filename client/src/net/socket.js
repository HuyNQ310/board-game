import { io } from 'socket.io-client';

/**
 * Socket.IO client instance (singleton).
 */
let socket = null;

const PLAYER_ID_KEY = 'meo-no:playerId';
const ROOM_CODE_KEY = 'meo-no:roomCode';

/**
 * Lazily creates and returns a singleton socket.io-client instance.
 * Connects to the same origin (no url provided) so Vite dev proxy (/socket.io)
 * and production same-origin static serving both work seamlessly.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (!socket) {
    socket = io();
  }
  return socket;
}

/**
 * Wraps socket.emit with built-in Socket.IO ack callback in a Promise.
 * Resolves with the server ack object:
 * - On success: { ok: true, ... }
 * - On failure: { ok: false, code, message }
 * Per rules.md section 6.1: "mọi sự kiện client gửi đều nhận ack một lần".
 *
 * @param {string} event
 * @param {any} [payload]
 * @returns {Promise<{ ok: boolean, [key: string]: any }>}
 */
export function emitWithAck(event, payload, { timeoutMs = 8000, retries = 1 } = {}) {
  const socketInstance = getSocket();
  const args = payload === undefined ? [event] : [event, payload];

  const attempt = () =>
    new Promise((resolve) => {
      // Socket.IO's own `.timeout()` guarantees the callback always fires,
      // even if the server's ack is ever dropped/delayed (network hiccup,
      // a stalled handler, a reconnect race) -- without this, a lost ack
      // would hang the caller's `await emitWithAck(...)` forever, freezing
      // the UI with no error (observed in testing: a long multi-player
      // match followed immediately by room:rematch + game:start could
      // occasionally lose the second ack).
      socketInstance.timeout(timeoutMs).emit(...args, (err, ack) => {
        if (err) {
          resolve({
            ok: false,
            code: 'SERVER_ERROR',
            message: 'Hết thời gian chờ phản hồi từ máy chủ',
            _timedOut: true,
          });
        } else {
          resolve(ack);
        }
      });
    });

  return attempt().then((res) => {
    if (res && res._timedOut && retries > 0) {
      return emitWithAck(event, payload, { timeoutMs, retries: retries - 1 });
    }
    if (res && res._timedOut) delete res._timedOut;
    return res;
  });
}

/**
 * Reads localStorage['meo-no:playerId'].
 * If missing, generates a UUID v4 via crypto.randomUUID(), stores it, and returns it.
 * Wrapped defensively in try/catch for private browsing compatibility (rules.md section 1 D14, 5.2).
 *
 * @returns {string}
 */
export function getOrCreatePlayerId() {
  try {
    let playerId = null;
    if (typeof localStorage !== 'undefined') {
      playerId = localStorage.getItem(PLAYER_ID_KEY) || localStorage[PLAYER_ID_KEY] || null;
    }

    if (!playerId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        playerId = crypto.randomUUID();
      } else {
        playerId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(PLAYER_ID_KEY, playerId);
        } catch {
          // Ignore storage quota / private browsing failure
        }
      }
    }

    return playerId;
  } catch {
    // If accessing localStorage throws (SecurityError), generate a transient ID
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Reads stored room code from localStorage['meo-no:roomCode'].
 * Wrapped defensively in try/catch (rules.md section 5.8).
 *
 * @returns {string | null}
 */
export function getStoredRoomCode() {
  try {
    if (typeof localStorage !== 'undefined') {
      const code = localStorage.getItem(ROOM_CODE_KEY) || localStorage[ROOM_CODE_KEY];
      return code || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stores room code into localStorage['meo-no:roomCode'].
 * If code is falsy, clears it.
 * Wrapped defensively in try/catch.
 *
 * @param {string | null | undefined} code
 */
export function setStoredRoomCode(code) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (code) {
        localStorage.setItem(ROOM_CODE_KEY, code);
      } else {
        localStorage.removeItem(ROOM_CODE_KEY);
      }
    }
  } catch {
    // Fall back to no-op on failure (e.g. private browsing)
  }
}

/**
 * Clears stored room code from localStorage['meo-no:roomCode'].
 * Wrapped defensively in try/catch.
 */
export function clearStoredRoomCode() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ROOM_CODE_KEY);
    }
  } catch {
    // Fall back to no-op on failure
  }
}
