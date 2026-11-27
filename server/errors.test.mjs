/**
 * server/errors.test.mjs
 *
 * Unit tests for server/errors.mjs using node:test and node:assert/strict.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_CODES,
  DEV_FALLBACK_MESSAGES,
  toErrorAck,
  mapGameErrorToCode,
} from './errors.mjs';

const EXPECTED_CODES = [
  'NAME_INVALID',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_PLAYING',
  'NOT_IN_ROOM',
  'NOT_HOST',
  'NEED_TWO_PLAYERS',
  'NOT_YOUR_TURN',
  'DEFUSE_PENDING',
  'NO_CARD',
  'INVALID_CARD',
  'INVALID_TARGET',
  'INVALID_ACTION',
  'GAME_OVER',
  'RATE_LIMIT',
  'SERVER_ERROR',
];

describe('ERROR_CODES', () => {
  it('is a frozen object', () => {
    assert.strictEqual(typeof ERROR_CODES, 'object');
    assert.notStrictEqual(ERROR_CODES, null);
    assert.strictEqual(Object.isFrozen(ERROR_CODES), true);
  });

  it('contains every code from rules.md section 6.2 with matching key and value', () => {
    assert.strictEqual(Object.keys(ERROR_CODES).length, 16);
    for (const code of EXPECTED_CODES) {
      assert.strictEqual(
        ERROR_CODES[code],
        code,
        `Expected ERROR_CODES.${code} to equal '${code}'`
      );
    }
  });

  it('supports iteration via for..of', () => {
    const collected = [...ERROR_CODES];
    assert.strictEqual(collected.length, 16);
    assert.deepStrictEqual(collected.sort(), [...EXPECTED_CODES].sort());
  });

  it('supports includes method', () => {
    assert.strictEqual(ERROR_CODES.includes('NOT_YOUR_TURN'), true);
    assert.strictEqual(ERROR_CODES.includes('NON_EXISTENT_CODE'), false);
  });
});

describe('DEV_FALLBACK_MESSAGES', () => {
  it('is a frozen object', () => {
    assert.strictEqual(typeof DEV_FALLBACK_MESSAGES, 'object');
    assert.notStrictEqual(DEV_FALLBACK_MESSAGES, null);
    assert.strictEqual(Object.isFrozen(DEV_FALLBACK_MESSAGES), true);
  });

  it('every code in ERROR_CODES has a DEV_FALLBACK_MESSAGES entry', () => {
    for (const code of Object.values(ERROR_CODES)) {
      const message = DEV_FALLBACK_MESSAGES[code];
      assert.strictEqual(
        typeof message,
        'string',
        `Expected DEV_FALLBACK_MESSAGES[${code}] to be a string`
      );
      assert.ok(
        message.trim().length > 0,
        `Expected DEV_FALLBACK_MESSAGES[${code}] to be non-empty`
      );
    }
  });

  it('does not contain unknown error codes', () => {
    const messageKeys = Object.keys(DEV_FALLBACK_MESSAGES);
    assert.strictEqual(messageKeys.length, 16);
    for (const key of messageKeys) {
      assert.strictEqual(
        EXPECTED_CODES.includes(key),
        true,
        `Unexpected key in DEV_FALLBACK_MESSAGES: ${key}`
      );
    }
  });
});

describe('toErrorAck', () => {
  it('returns the correct ack shape: { ok: false, code, message }', () => {
    const ack = toErrorAck(ERROR_CODES.NOT_YOUR_TURN);
    assert.deepStrictEqual(ack, {
      ok: false,
      code: 'NOT_YOUR_TURN',
      message: DEV_FALLBACK_MESSAGES.NOT_YOUR_TURN,
    });
  });

  it('matches rules.md section 6.1 shape for every error code', () => {
    for (const code of Object.values(ERROR_CODES)) {
      const ack = toErrorAck(code);
      assert.strictEqual(ack.ok, false);
      assert.strictEqual(ack.code, code);
      assert.strictEqual(ack.message, DEV_FALLBACK_MESSAGES[code]);
      assert.strictEqual(typeof ack.message, 'string');
    }
  });

  it('handles unknown codes gracefully', () => {
    const ack = toErrorAck('UNKNOWN_CUSTOM_CODE');
    assert.strictEqual(ack.ok, false);
    assert.strictEqual(ack.code, 'UNKNOWN_CUSTOM_CODE');
    assert.strictEqual(ack.message, undefined);
  });
});

describe('mapGameErrorToCode', () => {
  it('defaults to INVALID_ACTION for unrecognized errors', () => {
    assert.strictEqual(mapGameErrorToCode(), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(mapGameErrorToCode(null), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(mapGameErrorToCode(undefined), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(mapGameErrorToCode({}), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(
      mapGameErrorToCode(new Error('some totally arbitrary error message')),
      ERROR_CODES.INVALID_ACTION
    );
    assert.strictEqual(
      mapGameErrorToCode({ code: 'UNRECOGNIZED_CODE' }),
      ERROR_CODES.INVALID_ACTION
    );
    assert.strictEqual(
      mapGameErrorToCode({ message: 'completely unknown error' }),
      ERROR_CODES.INVALID_ACTION
    );
    assert.strictEqual(mapGameErrorToCode(12345), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(mapGameErrorToCode(true), ERROR_CODES.INVALID_ACTION);
    assert.strictEqual(mapGameErrorToCode('unrecognized_string'), ERROR_CODES.INVALID_ACTION);
  });

  it('maps error objects with .code property matching ERROR_CODES', () => {
    for (const code of EXPECTED_CODES) {
      assert.strictEqual(mapGameErrorToCode({ code }), code);
      assert.strictEqual(mapGameErrorToCode({ code: code.toLowerCase() }), code);
      assert.strictEqual(
        mapGameErrorToCode({ code: code.toLowerCase().replace(/_/g, '-') }),
        code
      );
    }
  });

  it('maps error objects with .errorCode property defensively', () => {
    assert.strictEqual(
      mapGameErrorToCode({ errorCode: 'NOT_YOUR_TURN' }),
      ERROR_CODES.NOT_YOUR_TURN
    );
    assert.strictEqual(
      mapGameErrorToCode({ errorCode: 'no_card' }),
      ERROR_CODES.NO_CARD
    );
  });

  it('maps errors where .message directly contains the error code', () => {
    assert.strictEqual(
      mapGameErrorToCode(new Error('NOT_YOUR_TURN')),
      ERROR_CODES.NOT_YOUR_TURN
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('DEFUSE_PENDING')),
      ERROR_CODES.DEFUSE_PENDING
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('NO_CARD')),
      ERROR_CODES.NO_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('INVALID_CARD')),
      ERROR_CODES.INVALID_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('INVALID_TARGET')),
      ERROR_CODES.INVALID_TARGET
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('GAME_OVER')),
      ERROR_CODES.GAME_OVER
    );
  });

  it('maps English descriptive error messages to specific error codes', () => {
    assert.strictEqual(
      mapGameErrorToCode(new Error('It is not your turn')),
      ERROR_CODES.NOT_YOUR_TURN
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Must defuse pending bomb')),
      ERROR_CODES.DEFUSE_PENDING
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Card not in hand')),
      ERROR_CODES.NO_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('This card cannot be played individually')),
      ERROR_CODES.INVALID_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Invalid target player')),
      ERROR_CODES.INVALID_TARGET
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Cannot target self')),
      ERROR_CODES.INVALID_TARGET
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Game is already over')),
      ERROR_CODES.GAME_OVER
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('At least 2 connected players are required')),
      ERROR_CODES.NEED_TWO_PLAYERS
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Only host can perform this action')),
      ERROR_CODES.NOT_HOST
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Room is full')),
      ERROR_CODES.ROOM_FULL
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Room playing')),
      ERROR_CODES.ROOM_PLAYING
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Room not found')),
      ERROR_CODES.ROOM_NOT_FOUND
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Not in room')),
      ERROR_CODES.NOT_IN_ROOM
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Invalid name length')),
      ERROR_CODES.NAME_INVALID
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Rate limit exceeded')),
      ERROR_CODES.RATE_LIMIT
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Internal server error occurred')),
      ERROR_CODES.SERVER_ERROR
    );
  });

  it('maps Vietnamese descriptive error messages from rules.md section 6.2', () => {
    assert.strictEqual(
      mapGameErrorToCode(new Error('Chưa đến lượt bạn')),
      ERROR_CODES.NOT_YOUR_TURN
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Bạn đang phải gỡ bom')),
      ERROR_CODES.DEFUSE_PENDING
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Không có lá này trong tay')),
      ERROR_CODES.NO_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Lá này không thể đánh riêng')),
      ERROR_CODES.INVALID_CARD
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Mục tiêu không hợp lệ')),
      ERROR_CODES.INVALID_TARGET
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Hành động không hợp lệ')),
      ERROR_CODES.INVALID_ACTION
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Ván đã kết thúc')),
      ERROR_CODES.GAME_OVER
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Cần ít nhất 2 người đang kết nối để bắt đầu')),
      ERROR_CODES.NEED_TWO_PLAYERS
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Chỉ chủ phòng mới làm được việc này')),
      ERROR_CODES.NOT_HOST
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Phòng đã đủ 6 người')),
      ERROR_CODES.ROOM_FULL
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Phòng đang chơi, không thể vào lúc này')),
      ERROR_CODES.ROOM_PLAYING
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Không tìm thấy phòng')),
      ERROR_CODES.ROOM_NOT_FOUND
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Bạn không còn trong phòng này')),
      ERROR_CODES.NOT_IN_ROOM
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Tên phải từ 1 đến 16 ký tự')),
      ERROR_CODES.NAME_INVALID
    );
    assert.strictEqual(
      mapGameErrorToCode(new Error('Thao tác quá nhanh, thử lại sau chút')),
      ERROR_CODES.RATE_LIMIT
    );
  });

  it('maps string error inputs directly', () => {
    assert.strictEqual(mapGameErrorToCode('NOT_YOUR_TURN'), ERROR_CODES.NOT_YOUR_TURN);
    assert.strictEqual(mapGameErrorToCode('not_your_turn'), ERROR_CODES.NOT_YOUR_TURN);
    assert.strictEqual(mapGameErrorToCode('NO_CARD'), ERROR_CODES.NO_CARD);
    assert.strictEqual(mapGameErrorToCode('INVALID_ACTION'), ERROR_CODES.INVALID_ACTION);
  });
});
