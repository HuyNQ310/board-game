/**
 * server/errors.mjs
 *
 * Machine-readable error codes and ack helpers for Mèo Nổ server.
 *
 * NOTE ON LOCALIZATION:
 * This project supports two UI languages (Vietnamese and English).
 * This module exports error CODES only (machine-readable), not hardcoded human-language
 * message strings. Localized message text for each code lives client-side in i18n files,
 * keyed by the same code strings.
 *
 * DEV_FALLBACK_MESSAGES contains short English strings for internal server-side logging:
 * dev fallback, not shown to end users in production.
 */

const RAW_ERROR_CODES = {
  NAME_INVALID: 'NAME_INVALID',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_PLAYING: 'ROOM_PLAYING',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_HOST: 'NOT_HOST',
  NEED_TWO_PLAYERS: 'NEED_TWO_PLAYERS',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  DEFUSE_PENDING: 'DEFUSE_PENDING',
  NO_CARD: 'NO_CARD',
  INVALID_CARD: 'INVALID_CARD',
  INVALID_TARGET: 'INVALID_TARGET',
  INVALID_ACTION: 'INVALID_ACTION',
  GAME_OVER: 'GAME_OVER',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
};

// Add non-enumerable iterator and includes method so ERROR_CODES can be used
// both as an enum object (ERROR_CODES.NOT_YOUR_TURN) and as an iterable/collection.
Object.defineProperty(RAW_ERROR_CODES, Symbol.iterator, {
  enumerable: false,
  value: function* () {
    yield* Object.values(this);
  },
});

Object.defineProperty(RAW_ERROR_CODES, 'includes', {
  enumerable: false,
  value: function (code) {
    return Object.values(this).includes(code);
  },
});

export const ERROR_CODES = Object.freeze(RAW_ERROR_CODES);

/**
 * Developer fallback messages for server-side logging and debugging only:
 * dev fallback, not shown to end users in production.
 */
export const DEV_FALLBACK_MESSAGES = Object.freeze({
  [ERROR_CODES.NAME_INVALID]: 'Player name must be between 1 and 16 characters',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'Room not found',
  [ERROR_CODES.ROOM_FULL]: 'Room is full (maximum 10 players)',
  [ERROR_CODES.ROOM_PLAYING]: 'Game already in progress in this room',
  [ERROR_CODES.NOT_IN_ROOM]: 'You are not in this room',
  [ERROR_CODES.NOT_HOST]: 'Only the host can perform this action',
  [ERROR_CODES.NEED_TWO_PLAYERS]: 'At least 2 connected players are required to start',
  [ERROR_CODES.NOT_YOUR_TURN]: 'Not your turn',
  [ERROR_CODES.DEFUSE_PENDING]: 'Defuse action is pending',
  [ERROR_CODES.NO_CARD]: 'Card not found in hand',
  [ERROR_CODES.INVALID_CARD]: 'Card cannot be played individually',
  [ERROR_CODES.INVALID_TARGET]: 'Invalid target player',
  [ERROR_CODES.INVALID_ACTION]: 'Invalid action',
  [ERROR_CODES.GAME_OVER]: 'Game is already over',
  [ERROR_CODES.RATE_LIMIT]: 'Rate limit exceeded, please slow down',
  [ERROR_CODES.SERVER_ERROR]: 'Internal server error',
});

/**
 * Returns an error ack payload conforming to rules.md section 6.1:
 * { ok: false, code, message: DEV_FALLBACK_MESSAGES[code] }
 *
 * Note: The message field here is a dev fallback for server/debugging;
 * actual end-user localization is performed client-side.
 *
 * @param {string} code - Machine-readable error code
 * @returns {{ ok: false, code: string, message: string | undefined }}
 */
export function toErrorAck(code) {
  return {
    ok: false,
    code,
    message: DEV_FALLBACK_MESSAGES[code],
  };
}

/**
 * Semantic pattern matcher rules for mapGameErrorToCode.
 */
const PATTERN_RULES = [
  {
    code: ERROR_CODES.DEFUSE_PENDING,
    test: (text) =>
      /\b(defuse_pending|pending_defuse|pending defuse|must defuse|defuse pending)\b/i.test(text) ||
      text.includes('gỡ bom'),
  },
  {
    code: ERROR_CODES.NOT_YOUR_TURN,
    test: (text) =>
      /\b(not_your_turn|not your turn|wrong turn|out of turn|not player turn)\b/i.test(text) ||
      text.includes('chưa đến lượt') ||
      text.includes('không phải lượt'),
  },
  {
    code: ERROR_CODES.NO_CARD,
    test: (text) =>
      /\b(no_card|no card|not in hand|missing card|card not found)\b/i.test(text) ||
      text.includes('không có lá') ||
      text.includes('không có bài'),
  },
  {
    code: ERROR_CODES.INVALID_CARD,
    test: (text) =>
      /\b(invalid_card|invalid card|cannot be played|cannot play this card)\b/i.test(text) ||
      text.includes('không thể đánh riêng') ||
      text.includes('không được đánh riêng'),
  },
  {
    code: ERROR_CODES.INVALID_TARGET,
    test: (text) =>
      /\b(invalid_target|invalid target|cannot target|wrong target)\b/i.test(text) ||
      text.includes('mục tiêu không hợp lệ') ||
      text.includes('target self') ||
      text.includes('target eliminated'),
  },
  {
    code: ERROR_CODES.GAME_OVER,
    test: (text) =>
      /\b(game_over|game over|game is over|already over|game finished)\b/i.test(text) ||
      text.includes('ván đã kết thúc'),
  },
  {
    code: ERROR_CODES.NEED_TWO_PLAYERS,
    test: (text) =>
      /\b(need_two_players|not enough players)\b/i.test(text) ||
      /\b(need|require|requires|required|at least|minimum)\b.*\b(2|two)\b.*\bplayer/i.test(text) ||
      /\b(2|two)\s+(connected\s+)?players\b/i.test(text) ||
      text.includes('cần ít nhất 2 người') ||
      text.includes('ít nhất 2 người') ||
      text.includes('cần 2 người'),
  },
  {
    code: ERROR_CODES.NOT_HOST,
    test: (text) =>
      /\b(not_host|not host|only host)\b/i.test(text) ||
      text.includes('chỉ chủ phòng'),
  },
  {
    code: ERROR_CODES.ROOM_FULL,
    test: (text) =>
      /\b(room_full|room full|room is full|room already full)\b/i.test(text) ||
      (text.includes('room') && text.includes('full')) ||
      text.includes('phòng đã đủ') ||
      text.includes('phòng đầy'),
  },
  {
    code: ERROR_CODES.ROOM_PLAYING,
    test: (text) =>
      /\b(room_playing|room playing)\b/i.test(text) ||
      text.includes('phòng đang chơi'),
  },
  {
    code: ERROR_CODES.ROOM_NOT_FOUND,
    test: (text) =>
      /\b(room_not_found|room not found)\b/i.test(text) ||
      text.includes('không tìm thấy phòng'),
  },
  {
    code: ERROR_CODES.NOT_IN_ROOM,
    test: (text) =>
      /\b(not_in_room|not in room)\b/i.test(text) ||
      text.includes('không còn trong phòng'),
  },
  {
    code: ERROR_CODES.NAME_INVALID,
    test: (text) =>
      /\b(name_invalid|name invalid|invalid name)\b/i.test(text) ||
      text.includes('tên phải từ'),
  },
  {
    code: ERROR_CODES.RATE_LIMIT,
    test: (text) =>
      /\b(rate_limit|rate limit)\b/i.test(text) ||
      text.includes('thao tác quá nhanh'),
  },
  {
    code: ERROR_CODES.SERVER_ERROR,
    test: (text) =>
      /\b(server_error|server error)\b/i.test(text) ||
      text.includes('lỗi hệ thống'),
  },
  {
    code: ERROR_CODES.INVALID_ACTION,
    test: (text) =>
      /\b(invalid_action|invalid action|illegal action)\b/i.test(text) ||
      text.includes('hành động không hợp lệ'),
  },
];

/**
 * Normalizes an identifier string into an uppercase underscore format.
 * E.g., 'not_your_turn' -> 'NOT_YOUR_TURN', 'not-your-turn' -> 'NOT_YOUR_TURN'.
 *
 * @param {unknown} val
 * @returns {string}
 */
function normalizeCodeString(val) {
  if (typeof val !== 'string') return '';
  return val.trim().toUpperCase().replace(/[-\s]+/g, '_');
}

/**
 * Maps an engine GameError to a machine-readable code from ERROR_CODES.
 * Defensively handles unknown shapes (.code, .message, strings, etc.).
 *
 * Per rules.md section 6.2:
 * "Mọi lỗi từ engine (GameError) map sang INVALID_ACTION nếu không khớp mã cụ thể hơn."
 *
 * @param {unknown} gameError - The error thrown by the game engine
 * @returns {string} The matched error code, defaulting to INVALID_ACTION
 */
export function mapGameErrorToCode(gameError) {
  if (!gameError) {
    return ERROR_CODES.INVALID_ACTION;
  }

  // 1. Direct string check
  if (typeof gameError === 'string') {
    const normalized = normalizeCodeString(gameError);
    if (ERROR_CODES[normalized]) {
      return ERROR_CODES[normalized];
    }
  }

  // 2. Direct code property check (e.g. gameError.code, gameError.errorCode)
  const rawCode =
    typeof gameError === 'object' && gameError !== null
      ? gameError.code ?? gameError.errorCode ?? null
      : null;

  if (rawCode) {
    const normalized = normalizeCodeString(String(rawCode));
    if (ERROR_CODES[normalized]) {
      return ERROR_CODES[normalized];
    }
  }

  // 3. Direct message property check if message equals a code identifier
  const rawMessage =
    typeof gameError === 'object' && gameError !== null
      ? gameError.message ?? null
      : typeof gameError === 'string'
      ? gameError
      : null;

  if (rawMessage) {
    const normalized = normalizeCodeString(String(rawMessage));
    if (ERROR_CODES[normalized]) {
      return ERROR_CODES[normalized];
    }
  }

  // 4. Semantic / keyword pattern matching against combined message and code text
  const combinedText = [
    typeof rawCode === 'string' ? rawCode : '',
    typeof rawMessage === 'string' ? rawMessage : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (combinedText) {
    for (const rule of PATTERN_RULES) {
      if (rule.test(combinedText)) {
        return rule.code;
      }
    }
  }

  // Default fallback per rules.md section 6.2
  return ERROR_CODES.INVALID_ACTION;
}
