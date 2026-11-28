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
    'reverse',
    'attack',
    'shuffle',
    'peek',
    'favor',
    'cat',
    'nope',
    'action_cancelled',
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
    assert.ok(typeof strings.log.reverse('Player1') === 'string');
    assert.ok(typeof strings.log.attack('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.shuffle('Player1') === 'string');
    assert.ok(typeof strings.log.peek('Player1') === 'string');
    assert.ok(typeof strings.log.favor('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.cat('Player1', 'Player2') === 'string');
    assert.ok(typeof strings.log.cat('Player1', 'Player2', strings.cards.taco) === 'string');
    assert.ok(typeof strings.log.nope('Player1', null, 1) === 'string');
    assert.ok(typeof strings.log.nope('Player1', null, 2) === 'string');
    assert.ok(typeof strings.log.action_cancelled('Player1', strings.cards.attack) === 'string');
    assert.ok(typeof strings.log.deck_reshuffled() === 'string');
    assert.ok(typeof strings.log.game_over('Player1') === 'string');
    assert.ok(typeof strings.log.game_over(null) === 'string');
  }
});

test('all 12 cards exist with expected names in vi and en', () => {
  const allCardKeys = [
    'boom',
    'defuse',
    'attack',
    'skip',
    'reverse',
    'shuffle',
    'favor',
    'peek',
    'nope',
    'cat',
    'taco',
    'potato',
  ];

  for (const locale of ['vi', 'en']) {
    const strings = getStrings(locale);
    for (const key of allCardKeys) {
      assert.strictEqual(typeof strings.cards[key], 'string', `Card ${key} missing in ${locale}`);
      assert.ok(strings.cards[key].length > 0, `Card ${key} empty in ${locale}`);
    }
  }

  const viStrings = getStrings('vi');
  const enStrings = getStrings('en');
  assert.strictEqual(viStrings.cards.reverse, 'Đảo Chiều');
  assert.strictEqual(viStrings.cards.nope, 'KHÔNG!');
  assert.strictEqual(viStrings.cards.taco, 'Mèo Taco');
  assert.strictEqual(viStrings.cards.potato, 'Mèo Khoai Tây');
  assert.strictEqual(enStrings.cards.reverse, 'Reverse');
  assert.strictEqual(enStrings.cards.nope, 'Nope');
  assert.strictEqual(enStrings.cards.taco, 'Taco Cat');
  assert.strictEqual(enStrings.cards.potato, 'Hairy Potato Cat');
});

test('actions, direction, nopeBanner, and new log templates work as expected', () => {
  const viStrings = getStrings('vi');
  const enStrings = getStrings('en');

  assert.strictEqual(viStrings.actions.reverse, 'Đảo chiều');
  assert.strictEqual(viStrings.actions.nope, 'KHÔNG!');
  assert.strictEqual(viStrings.actions.passNope, 'Cho qua');
  assert.strictEqual(enStrings.actions.reverse, 'Reverse');
  assert.strictEqual(enStrings.actions.nope, 'Nope');
  assert.strictEqual(enStrings.actions.passNope, 'Allow');

  assert.strictEqual(viStrings.game.directionCw, 'Thuận chiều');
  assert.strictEqual(viStrings.game.directionCcw, 'Ngược chiều');
  assert.strictEqual(enStrings.game.directionCw, 'Clockwise');
  assert.strictEqual(enStrings.game.directionCcw, 'Counter-clockwise');

  assert.strictEqual(viStrings.nopeBanner.title('Alice', 'Truy Đuổi'), 'Alice đánh Truy Đuổi');
  assert.strictEqual(viStrings.nopeBanner.noped('Bob', 2), 'Bob đã KHÔNG! (×2)');
  assert.strictEqual(enStrings.nopeBanner.title('Alice', 'Attack'), 'Alice played Attack');
  assert.strictEqual(enStrings.nopeBanner.noped('Bob', 2), 'Bob played NOPE! (×2)');

  assert.strictEqual(viStrings.log.reverse('Alice'), 'Alice đánh Đảo Chiều');
  assert.strictEqual(enStrings.log.reverse('Alice'), 'Alice played Reverse');
  assert.strictEqual(viStrings.log.nope('Bob', null, 1), 'Bob đánh KHÔNG!');
  assert.strictEqual(viStrings.log.nope('Bob', null, 2), 'Bob đánh KHÔNG! (×2)');
  assert.strictEqual(enStrings.log.nope('Bob', null, 1), 'Bob played Nope');
  assert.strictEqual(enStrings.log.nope('Bob', null, 2), 'Bob played Nope (×2)');
  assert.strictEqual(viStrings.log.action_cancelled('Alice', 'Truy Đuổi'), 'Hành động Truy Đuổi của Alice đã bị chặn!');
  assert.strictEqual(enStrings.log.action_cancelled('Alice', 'Attack'), "Alice's Attack was noped!");
  assert.strictEqual(viStrings.log.cat('Alice', 'Bob'), 'Alice chơi cặp mèo nhắm vào Bob');
  assert.strictEqual(viStrings.log.cat('Alice', 'Bob', 'Mèo Taco'), 'Alice chơi cặp Mèo Taco nhắm vào Bob');
  assert.strictEqual(enStrings.log.cat('Alice', 'Bob'), 'Alice played a cat pair targeting Bob');
  assert.strictEqual(enStrings.log.cat('Alice', 'Bob', 'Taco Cat'), 'Alice played a Taco Cat pair targeting Bob');
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

  // countdown & defuse insertPosition templates
  assert.strictEqual(viStrings.actions.countdown(5), 'Còn 5 giây');
  assert.strictEqual(enStrings.actions.countdown(5), '5s left');
  assert.strictEqual(viStrings.dialog.defuse.insertPosition(2, 10), 'Vị trí: 2 / 10');
  assert.strictEqual(enStrings.dialog.defuse.insertPosition(2, 10), 'Position: 2 / 10');
  assert.strictEqual(viStrings.chat.unreadButtonAriaLabel(3), 'Trò chuyện (3 tin nhắn mới)');
  assert.strictEqual(enStrings.chat.unreadButtonAriaLabel(1), 'Chat (1 unread message)');
  assert.strictEqual(enStrings.chat.unreadButtonAriaLabel(3), 'Chat (3 unread messages)');
});
