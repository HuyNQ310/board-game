import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, DEFAULT_LOCALE, getStrings, missingKeys } from './index.js';
import vi from './vi.js';
import en from './en.js';

test('LOCALES and DEFAULT_LOCALE constants', () => {
  assert.deepStrictEqual(LOCALES, ['vi', 'en']);
  assert.strictEqual(DEFAULT_LOCALE, 'vi');
});

test('getStrings returns correct locale dictionaries and falls back to vi', () => {
  const viStrings = getStrings('vi');
  const enStrings = getStrings('en');
  assert.strictEqual(typeof viStrings, 'object');
  assert.strictEqual(typeof enStrings, 'object');
  assert.notStrictEqual(viStrings, null);
  assert.notStrictEqual(enStrings, null);

  assert.strictEqual(viStrings, vi);
  assert.strictEqual(enStrings, en);

  // Fallbacks
  assert.strictEqual(getStrings('fr'), vi);
  assert.strictEqual(getStrings('de'), vi);
  assert.strictEqual(getStrings(''), vi);
  assert.strictEqual(getStrings(null), vi);
  assert.strictEqual(getStrings(undefined), vi);
});

test('missingKeys between vi and en returns an empty array in both directions', () => {
  const missingInEn = missingKeys('vi', 'en');
  const missingInVi = missingKeys('en', 'vi');

  assert.deepStrictEqual(missingInEn, [], `Keys present in vi but missing in en: ${missingInEn.join(', ')}`);
  assert.deepStrictEqual(missingInVi, [], `Keys present in en but missing in vi: ${missingInVi.join(', ')}`);
});

test('missingKeys detects missing keys in objects correctly', () => {
  const objA = {
    a: 1,
    nested: {
      b: 2,
      c: 3,
    },
  };
  const objB = {
    a: 1,
    nested: {
      b: 2,
    },
  };

  assert.deepStrictEqual(missingKeys(objA, objB), ['nested.c']);
  assert.deepStrictEqual(missingKeys(objB, objA), []);
});

test('all 16 required error codes from section 6.2 exist in errors', () => {
  const requiredErrorCodes = [
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

  for (const locale of ['vi', 'en']) {
    const strings = getStrings(locale);
    assert.ok(strings.errors, `errors object missing in ${locale}`);
    for (const code of requiredErrorCodes) {
      assert.strictEqual(
        typeof strings.errors[code],
        'string',
        `Error code ${code} is missing or not a string in ${locale}`
      );
      assert.ok(strings.errors[code].length > 0, `Error message for ${code} is empty in ${locale}`);
    }
  }
});

test('all 12 required event log templates from section E2 exist in log and are callable', () => {
  const requiredEvents = [
    'draw',
    'bomb_drawn',
    'defused',
    'eliminated',
    'skip',
    'attack',
    'shuffle',
    'peek',
    'favor',
    'cat',
    'deck_reshuffled',
    'game_over',
  ];

  for (const locale of ['vi', 'en']) {
    const strings = getStrings(locale);
    assert.ok(strings.log, `log object missing in ${locale}`);
    for (const event of requiredEvents) {
      assert.strictEqual(
        typeof strings.log[event],
        'function',
        `Log template ${event} is missing or not a function in ${locale}`
      );
    }

    // Verify sample invocations
    assert.ok(typeof strings.log.draw('Player1') === 'string');
    assert.ok(typeof strings.log.bomb_drawn('Player1') === 'string');
    assert.ok(typeof strings.log.defused('Player1') === 'string');
    assert.ok(typeof strings.log.eliminated('Player1', 'bomb') === 'string');
    assert.ok(typeof strings.log.eliminated('Player1', 'disconnect') === 'string');
    assert.ok(typeof strings.log.skip('Player1') === 'string');
    assert.ok(typeof strings.log.attack('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.shuffle('Player1') === 'string');
    assert.ok(typeof strings.log.peek('Player1') === 'string');
    assert.ok(typeof strings.log.favor('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.cat('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.deck_reshuffled() === 'string');
    assert.ok(typeof strings.log.game_over('Player1') === 'string');
    assert.ok(typeof strings.log.game_over(null) === 'string');
  }
});

test('template functions work as expected', () => {
  const viStrings = getStrings('vi');
  const enStrings = getStrings('en');

  // turnsLeft
  assert.strictEqual(viStrings.game.turnsLeft(2), 'Còn 2 lượt');
  assert.strictEqual(enStrings.game.turnsLeft(1), '1 turn left');
  assert.strictEqual(enStrings.game.turnsLeft(2), '2 turns left');

  // defusing
  assert.strictEqual(viStrings.dialog.defuse.defusing('Alice'), 'Alice đang gỡ bom…');
  assert.strictEqual(enStrings.dialog.defuse.defusing('Alice'), 'Alice is defusing…');

  // gameOver winner
  assert.strictEqual(viStrings.gameOver.winner('Bob'), 'Bob đã chiến thắng!');
  assert.strictEqual(enStrings.gameOver.winner('Bob'), 'Bob won the game!');
});
