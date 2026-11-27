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
export function emitWithAck(event, payload) {
  const socketInstance = getSocket();
  return new Promise((resolve) => {
    if (payload === undefined) {
      socketInstance.emit(event, (ack) => {
        resolve(ack);
      });
    } else {
      socketInstance.emit(event, payload, (ack) => {
        resolve(ack);
      });
    }
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
