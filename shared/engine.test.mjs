import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD,
  GameError,
  createGame,
  applyAction,
  eliminatePlayer,
  viewFor,
  MAX_PLAYERS,
} from './engine.mjs';

/**
 * Tạo RNG giả lập xác định dựa trên chuỗi giá trị tuần tự.
 */
function createMockRng(values = [0.1]) {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx++;
    return val;
  };
}

// =============================================================================
// 1. API Exports và Constants
// =============================================================================

test('CARD: frozen object with correct card-type constants', () => {
  assert.equal(Object.isFrozen(CARD), true);
  assert.equal(CARD.boom, 'boom');
  assert.equal(CARD.defuse, 'defuse');
  assert.equal(CARD.attack, 'attack');
  assert.equal(CARD.skip, 'skip');
  assert.equal(CARD.shuffle, 'shuffle');
  assert.equal(CARD.favor, 'favor');
  assert.equal(CARD.peek, 'peek');
  assert.equal(CARD.cat, 'cat');
  assert.equal(Object.keys(CARD).length, 8);
});

test('GameError: is Error subclass with name and code', () => {
  const err = new GameError('Lỗi kiểm thử', 'INVALID_ACTION');
  assert.ok(err instanceof Error);
  assert.ok(err instanceof GameError);
  assert.equal(err.name, 'GameError');
  assert.equal(err.message, 'Lỗi kiểm thử');
  assert.equal(err.code, 'INVALID_ACTION');
});

// =============================================================================
// 2. Section 4.1: Deck composition and counts
// =============================================================================

test('Section 4.1: Deck composition counts for 2 to 6 players', () => {
  for (let n = 2; n <= 6; n++) {
    const playerIds = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    const game = createGame(playerIds);

    // Thu thập tất cả các lá bài trong ván (bộ rút + tay người chơi)
    const allCards = [...game.deck];
    for (const p of game.players) {
      allCards.push(...p.hand);
    }

    const counts = {};
    for (const c of allCards) {
      counts[c] = (counts[c] || 0) + 1;
    }

    assert.equal(counts[CARD.boom], n - 1, `n=${n}: boom count must be ${n - 1}`);
    assert.equal(counts[CARD.defuse], 2 + n, `n=${n}: defuse count must be ${2 + n}`);
    assert.equal(counts[CARD.attack], 4, `n=${n}: attack count must be 4`);
    assert.equal(counts[CARD.skip], 4, `n=${n}: skip count must be 4`);
    assert.equal(counts[CARD.shuffle], 4, `n=${n}: shuffle count must be 4`);
    assert.equal(counts[CARD.favor], 4, `n=${n}: favor count must be 4`);
    assert.equal(counts[CARD.peek], 5, `n=${n}: peek count must be 5`);
    assert.equal(counts[CARD.cat], 8, `n=${n}: cat count must be 8`);

    const totalCards = 2 * n + 30;
    assert.equal(allCards.length, totalCards, `n=${n}: total cards must be ${totalCards}`);
  }
});

// =============================================================================
// 3. Section 4.2: Dealing rules and constraints
// =============================================================================

test('Section 4.2: Dealing gives 1 defuse + 4 ordinary cards to each player', () => {
  const game = createGame(['p1', 'p2', 'p3']);
  for (const p of game.players) {
    assert.equal(p.hand.length, 5);
    const defuses = p.hand.filter(c => c === CARD.defuse);
    assert.equal(defuses.length, 1);
    const booms = p.hand.filter(c => c === CARD.boom);
    assert.equal(booms.length, 0);
  }

  // Draw pile chứa phần thường còn lại + (n-1) boom + 2 defuse
  const deckDefuses = game.deck.filter(c => c === CARD.defuse);
  assert.equal(deckDefuses.length, 2);
  const deckBooms = game.deck.filter(c => c === CARD.boom);
  assert.equal(deckBooms.length, 2); // n=3 -> 3 - 1 = 2
});

test('Section 4.2: Dealing rejects invalid player count (< 2 or > MAX_PLAYERS)', () => {
  assert.throws(
    () => createGame(['p1']),
    err => err instanceof GameError && err.code === 'NEED_TWO_PLAYERS'
  );
  assert.throws(
    () => createGame(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11']),
    err => err instanceof GameError && err.code === 'NEED_TWO_PLAYERS'
  );
});

test('Extended player count: createGame deals correctly for 7-10 players (scaled deck)', () => {
  for (let n = 7; n <= MAX_PLAYERS; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    const game = createGame(ids, () => 0.5);
    assert.equal(game.players.length, n);
    for (const p of game.players) {
      assert.equal(p.hand.length, 5); // 1 defuse + 4 ordinary
      assert.equal(p.hand.filter(c => c === CARD.defuse).length, 1);
    }
    const deckBooms = game.deck.filter(c => c === CARD.boom);
    assert.equal(deckBooms.length, n - 1);
    const deckDefuses = game.deck.filter(c => c === CARD.defuse);
    assert.equal(deckDefuses.length, 2);
    // Total defuse cards in play must equal 2 + n (section 4.1).
    const handDefuses = game.players.reduce((sum, p) => sum + p.hand.filter(c => c === CARD.defuse).length, 0);
    assert.equal(handDefuses + deckDefuses.length, 2 + n);
  }
});

test('Section 4.2: Dealing rejects duplicate player IDs', () => {
  assert.throws(
    () => createGame(['p1', 'p1']),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );
});

// =============================================================================
// 4. Section 4.3: Turn structure (non-drawing plays vs turn-ending actions)
// =============================================================================

test('Section 4.3: draw action ends turn and advances to next player when turnsLeft reaches 0', () => {
  const s0 = createGame(['p1', 'p2']);
  // Đặt lá trên cùng của deck là skip (không phải boom)
  s0.deck[0] = CARD.skip;
  const initialHandCount = s0.players[0].hand.length;

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.players[0].hand.length, initialHandCount + 1);
  assert.equal(s1.players[0].hand[s1.players[0].hand.length - 1], CARD.skip);
  assert.equal(s1.log[s1.log.length - 1].type, 'draw');
  assert.equal(s1.log[s1.log.length - 1].actor, 'p1');
});

test('Section 4.3: skip action ends 1 turn without drawing', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.skip];
  const deckCountBefore = s0.deck.length;

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.deck.length, deckCountBefore); // Không rút bài
  assert.equal(s1.discardPile[s1.discardPile.length - 1], CARD.skip);
  assert.equal(s1.log[s1.log.length - 1].type, 'skip');
});

test('Section 4.3: skip when turnsLeft > 1 reduces turnsLeft by 1 and keeps turn', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.turnsLeft = 2;
  s0.players[0].hand = [CARD.skip, CARD.skip];

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s1.currentPlayerId, 'p1');
  assert.equal(s1.turnsLeft, 1);

  const s2 = applyAction(s1, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s2.currentPlayerId, 'p2');
  assert.equal(s2.turnsLeft, 1);
});

test('Section 4.3: attack gives next player 2 + (turnsLeft - 1) turns', () => {
  // Case A: turnsLeft = 1 -> next gets 2 + 0 = 2 turns
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.attack];
  s0.turnsLeft = 1;

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'attack' });
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 2);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'attack',
    actor: 'p1',
    target: 'p2',
  });

  // Case B: turnsLeft = 2 -> next gets 2 + (2 - 1) = 3 turns (stacking rule)
  s1.players[1].hand = [CARD.attack];
  const s2 = applyAction(s1, 'p2', { type: 'play', card: 'attack' });
  assert.equal(s2.currentPlayerId, 'p1');
  assert.equal(s2.turnsLeft, 3);
});

test('Section 4.3: shuffle, peek, favor, cat do not end the turn', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [
    CARD.shuffle,
    CARD.peek,
    CARD.favor,
    CARD.cat,
    CARD.cat,
  ];
  s0.players[1].hand = [CARD.defuse, CARD.skip];

  // 1. Shuffle
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'shuffle' });
  assert.equal(s1.currentPlayerId, 'p1');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.log[s1.log.length - 1].type, 'shuffle');

  // 2. Peek
  const s2 = applyAction(s1, 'p1', { type: 'play', card: 'peek' });
  assert.equal(s2.currentPlayerId, 'p1');
  assert.equal(s2.turnsLeft, 1);
  assert.equal(s2.log[s2.log.length - 1].type, 'peek');
  assert.ok(Array.isArray(s2.peek?.cards));
  assert.equal(s2.peek.cards.length, 3);

  // 3. Favor (lấy ngẫu nhiên 1 lá của p2)
  const p1HandBeforeFavor = s2.players[0].hand.length;
  const p2HandBeforeFavor = s2.players[1].hand.length;
  const s3 = applyAction(s2, 'p1', { type: 'play', card: 'favor', target: 'p2' });
  assert.equal(s3.currentPlayerId, 'p1');
  assert.equal(s3.turnsLeft, 1);
  assert.equal(s3.players[0].hand.length, p1HandBeforeFavor - 1 + 1); // Đánh favor (-1), nhận 1 lá (+1)
  assert.equal(s3.players[1].hand.length, p2HandBeforeFavor - 1);
  assert.deepEqual(s3.log[s3.log.length - 1], {
    type: 'favor',
    actor: 'p1',
    target: 'p2',
  });

  // 4. Cat pair
  const p1HandBeforeCat = s3.players[0].hand.length;
  const p2HandBeforeCat = s3.players[1].hand.length;
  const s4 = applyAction(s3, 'p1', { type: 'catPair', target: 'p2' });
  assert.equal(s4.currentPlayerId, 'p1');
  assert.equal(s4.turnsLeft, 1);
  assert.equal(s4.players[0].hand.length, p1HandBeforeCat - 2 + 1); // Đánh 2 lá mèo, nhận 1 lá
  assert.equal(s4.players[1].hand.length, p2HandBeforeCat - 1);
  assert.deepEqual(s4.log[s4.log.length - 1], {
    type: 'cat',
    actor: 'p1',
    target: 'p2',
  });
});

// =============================================================================
// 5. Section 4.4: Bomb and Defuse rules
// =============================================================================

test('Section 4.4: drawing a bomb with defuse enters defuse phase and requires insertAt', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom, CARD.skip, CARD.attack];
  s0.players[0].hand = [CARD.defuse];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'defuse');
  assert.equal(s1.pendingDefuseId, 'p1');
  assert.equal(s1.deck.length, 2); // Bom đã được rút ra
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'bomb_drawn',
    actor: 'p1',
  });

  // Thử hành động khác khi đang defuse sẽ bị chặn
  assert.throws(
    () => applyAction(s1, 'p1', { type: 'draw' }),
    err => err instanceof GameError && err.code === 'DEFUSE_PENDING'
  );

  // Người khác cố can thiệp sẽ bị chặn
  assert.throws(
    () => applyAction(s1, 'p2', { type: 'defuse', insertAt: 0 }),
    err => err instanceof GameError && err.code === 'NOT_YOUR_TURN'
  );

  // Gỡ bom thành công tại vị trí insertAt = 1
  const s2 = applyAction(s1, 'p1', { type: 'defuse', insertAt: 1 });
  assert.equal(s2.phase, 'play');
  assert.equal(s2.pendingDefuseId, null);
  assert.equal(s2.players[0].hand.length, 0); // Defuse đã bị bỏ vào discard
  assert.equal(s2.discardPile[s2.discardPile.length - 1], CARD.defuse);
  assert.equal(s2.deck.length, 3);
  assert.equal(s2.deck[1], CARD.boom); // Bom nằm ở vị trí index 1
  assert.equal(s2.currentPlayerId, 'p2'); // Lượt kết thúc
  assert.deepEqual(s2.log[s2.log.length - 1], {
    type: 'defused',
    actor: 'p1',
  });
});

test('Section 4.4: insertAt clamps to [0, deckCount]', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom, CARD.skip];
  s0.players[0].hand = [CARD.defuse];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });

  // Test clamp dưới (< 0) -> 0
  const s2 = applyAction(s1, 'p1', { type: 'defuse', insertAt: -10 });
  assert.equal(s2.deck[0], CARD.boom);

  // Test clamp trên (> deck.length) -> cuối bộ rút
  s2.deck = [CARD.boom, CARD.skip];
  s2.players[1].hand = [CARD.defuse];
  const s3 = applyAction(s2, 'p2', { type: 'draw' });
  const s4 = applyAction(s3, 'p2', { type: 'defuse', insertAt: 999 });
  assert.equal(s4.deck[s4.deck.length - 1], CARD.boom);
});

test('Section 4.4: drawing a bomb without defuse eliminates player', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.deck = [CARD.boom, CARD.skip];
  s0.players[0].hand = [CARD.skip, CARD.attack]; // Không có defuse

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.players[0].alive, false);
  assert.equal(s1.players[0].hand.length, 0);
  assert.ok(s1.discardPile.includes(CARD.boom));
  assert.ok(s1.discardPile.includes(CARD.skip));
  assert.ok(s1.discardPile.includes(CARD.attack));
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'eliminated',
    actor: 'p1',
    reason: 'bomb',
  });
});

// =============================================================================
// 6. Section 4.5: Constraints
// =============================================================================

test('Section 4.5: boom and defuse cannot be played as ordinary cards', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.boom, CARD.defuse];

  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'boom' }),
    err => err instanceof GameError && err.code === 'INVALID_CARD'
  );

  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'defuse' }),
    err => err instanceof GameError && err.code === 'INVALID_CARD'
  );
});

test('Section 4.5: cat requires exactly 2 cards in hand', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.cat]; // Chỉ có 1 lá mèo

  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', target: 'p2' }),
    err => err instanceof GameError && err.code === 'NO_CARD'
  );
});

test('Section 4.5: cannot target self or eliminated player', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.favor, CARD.cat, CARD.cat];
  s0.players[2].alive = false; // p3 đã bị loại

  // Nhắm chính mình
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'favor', target: 'p1' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );

  // Nhắm người đã bị loại
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'favor', target: 'p3' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );

  // Cat nhắm người đã bị loại
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', target: 'p3' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );
});

test('Section 4.5: reshuffle discard into draw pile when draw pile empties', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [];
  s0.discardPile = [CARD.skip, CARD.attack, CARD.shuffle];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.deck.length, 2); // 3 lá xáo lại, đã rút 1 lá còn 2
  assert.equal(s1.discardPile.length, 0);
  assert.equal(s1.log.some(e => e.type === 'deck_reshuffled'), true);
});

test('Section 4.5: game ends with no winner when both draw pile and discard pile are empty', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [];
  s0.discardPile = [];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'over');
  assert.equal(s1.winnerId, null);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'game_over',
    winnerId: null,
  });
});

// =============================================================================
// 7. Section 4.6: End of game
// =============================================================================

test('Section 4.6: exactly one player alive -> that player wins', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom];
  s0.players[0].hand = []; // Không có defuse

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'over');
  assert.equal(s1.winnerId, 'p2');
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'game_over',
    winnerId: 'p2',
  });

  // Không cho phép hành động khi game đã kết thúc
  assert.throws(
    () => applyAction(s1, 'p2', { type: 'draw' }),
    err => err instanceof GameError && err.code === 'GAME_OVER'
  );
});

// =============================================================================
// 8. E1: Version requirements
// =============================================================================

test('E1: state.version starts at 0 and increments by 1 on every successful applyAction', () => {
  const s0 = createGame(['p1', 'p2']);
  assert.equal(s0.version, 0);

  s0.deck[0] = CARD.skip;
  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.version, 1);

  s1.deck[0] = CARD.skip;
  const s2 = applyAction(s1, 'p2', { type: 'draw' });
  assert.equal(s2.version, 2);

  // Thao tác lỗi không được tăng version
  assert.throws(() => applyAction(s2, 'p2', { type: 'draw' }));
  assert.equal(s2.version, 2);
});

// =============================================================================
// 9. E2: Public event log table & shapes
// =============================================================================

test('E2: Public event log shapes match specification table exactly', () => {
  let state = createGame(['p1', 'p2']);
  state.players[0].hand = [CARD.peek, CARD.skip, CARD.defuse];
  state.players[1].hand = [CARD.attack];
  state.deck = [CARD.boom, CARD.defuse];

  // 1. peek: actor
  state = applyAction(state, 'p1', { type: 'play', card: 'peek' });
  assert.deepEqual(state.log[state.log.length - 1], {
    type: 'peek',
    actor: 'p1',
  });

  // 2. skip: actor
  state = applyAction(state, 'p1', { type: 'play', card: 'skip' });
  assert.deepEqual(state.log[state.log.length - 1], {
    type: 'skip',
    actor: 'p1',
  });

  // 3. attack: actor, target
  state = applyAction(state, 'p2', { type: 'play', card: 'attack' });
  assert.deepEqual(state.log[state.log.length - 1], {
    type: 'attack',
    actor: 'p2',
    target: 'p1',
  });

  // 4. bomb_drawn: actor
  state = applyAction(state, 'p1', { type: 'draw' });
  assert.deepEqual(state.log[state.log.length - 1], {
    type: 'bomb_drawn',
    actor: 'p1',
  });

  // 5. defused: actor
  state = applyAction(state, 'p1', { type: 'defuse', insertAt: 0 });
  assert.deepEqual(state.log[state.log.length - 1], {
    type: 'defused',
    actor: 'p1',
  });
});

// =============================================================================
// 10. E3: eliminatePlayer requirements
// =============================================================================

test('E3: eliminatePlayer sets alive=false, moves hand to discard, advances turn, ends game if 1 remains', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.skip, CARD.defuse];

  // Loại p1 đang có lượt
  const s1 = eliminatePlayer(s0, 'p1', 'disconnect');
  assert.equal(s1.players[0].alive, false);
  assert.equal(s1.players[0].hand.length, 0);
  assert.ok(s1.discardPile.includes(CARD.skip));
  assert.ok(s1.discardPile.includes(CARD.defuse));
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'eliminated',
    actor: 'p1',
    reason: 'disconnect',
  });

  // Loại p3 không có lượt: lượt của p2 vẫn giữ nguyên
  const s2 = eliminatePlayer(s1, 'p3', 'disconnect');
  assert.equal(s2.players[2].alive, false);
  assert.equal(s2.phase, 'over'); // Còn mỗi p2 sống -> kết thúc ván
  assert.equal(s2.winnerId, 'p2');
  assert.deepEqual(s2.log[s2.log.length - 1], {
    type: 'game_over',
    winnerId: 'p2',
  });
});

test('E3: eliminatePlayer cancels pending defuse phase if target is pendingDefuse', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom];
  s0.players[0].hand = [CARD.defuse];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'defuse');
  assert.equal(s1.pendingDefuseId, 'p1');

  // p1 mất kết nối khi đang phải gỡ bom
  const s2 = eliminatePlayer(s1, 'p1', 'disconnect');
  assert.equal(s2.phase, 'over'); // Chỉ còn p2 sống -> game over
  assert.equal(s2.pendingDefuseId, null);
  assert.ok(s2.discardPile.includes(CARD.boom)); // Bom được bỏ vào discard
  assert.equal(s2.winnerId, 'p2');
});

// =============================================================================
// 11. E4 & View leaks checks
// =============================================================================

test('E4: viewFor never leaks other players hands, deck contents, or other peeks', () => {
  let state = createGame(['p1', 'p2']);
  state.players[0].hand = [CARD.defuse, CARD.peek];
  state.players[1].hand = [CARD.attack, CARD.skip];
  state.deck = [CARD.cat, CARD.shuffle, CARD.boom];

  // p1 thực hiện peek
  state = applyAction(state, 'p1', { type: 'play', card: 'peek' });

  // View cho p1 (người đánh peek)
  const viewP1 = viewFor(state, 'p1');
  assert.equal(viewP1.version, state.version);
  assert.equal(viewP1.phase, 'play');
  assert.equal(viewP1.currentPlayerId, 'p1');
  assert.equal(viewP1.deckCount, 3);
  assert.equal(viewP1.deck, undefined, 'deck array must NOT exist in view');
  assert.deepEqual(viewP1.peek, [CARD.cat, CARD.shuffle, CARD.boom]);

  // Kiểm tra thông tin người chơi trong viewP1
  const p1Self = viewP1.players.find(p => p.id === 'p1');
  assert.ok(Array.isArray(p1Self.hand));
  assert.equal(p1Self.handCount, p1Self.hand.length);

  const p2Other = viewP1.players.find(p => p.id === 'p2');
  assert.equal(p2Other.handCount, 2);
  assert.equal(p2Other.hand, undefined, 'Other player hand must NOT exist');

  // View cho p2 (đối thủ)
  const viewP2 = viewFor(state, 'p2');
  assert.equal(viewP2.peek, null, 'peek must be null for non-peeking player');
  const p1FromP2 = viewP2.players.find(p => p.id === 'p1');
  assert.equal(p1FromP2.hand, undefined, 'p1 hand must NOT exist in p2 view');
  const p2Self = viewP2.players.find(p => p.id === 'p2');
  assert.ok(Array.isArray(p2Self.hand));
  assert.equal(p2Self.hand.length, 2);
});

test('E4: peek resets to null on subsequent action', () => {
  let state = createGame(['p1', 'p2']);
  state.players[0].hand = [CARD.peek, CARD.skip];
  state.deck = [CARD.cat, CARD.shuffle, CARD.boom];

  state = applyAction(state, 'p1', { type: 'play', card: 'peek' });
  assert.ok(viewFor(state, 'p1').peek !== null);

  state = applyAction(state, 'p1', { type: 'play', card: 'skip' });
  assert.equal(viewFor(state, 'p1').peek, null);
});

// =============================================================================
// 12. E5: Purity requirements
// =============================================================================

test('E5: applyAction, eliminatePlayer, viewFor do not mutate input state, and createGame does not mutate playerIds', () => {
  const playerIds = ['p1', 'p2'];
  const playerIdsCopy = [...playerIds];
  const originalState = createGame(playerIds);
  assert.deepEqual(playerIds, playerIdsCopy, 'playerIds array mutated by createGame');

  originalState.deck = [CARD.skip, CARD.boom];
  originalState.players[0].hand = [CARD.defuse];
  originalState.players[1].hand = [CARD.skip];

  const serializedBefore = JSON.stringify(originalState);

  // 1. applyAction
  applyAction(originalState, 'p1', { type: 'draw' });
  assert.equal(JSON.stringify(originalState), serializedBefore, 'originalState mutated by applyAction');

  // 2. eliminatePlayer
  eliminatePlayer(originalState, 'p2', 'disconnect');
  assert.equal(JSON.stringify(originalState), serializedBefore, 'originalState mutated by eliminatePlayer');

  // 3. viewFor
  viewFor(originalState, 'p1');
  assert.equal(JSON.stringify(originalState), serializedBefore, 'originalState mutated by viewFor');
});

test('Section 4.2 & 6.6: createGame accepts player objects with custom names and viewFor exposes names', () => {
  const game = createGame([
    { id: 'u1', name: 'An' },
    { id: 'u2', name: 'Bình' },
  ]);
  const view = viewFor(game, 'u1');
  assert.equal(view.players[0].name, 'An');
  assert.equal(view.players[1].name, 'Bình');
  assert.equal(view.discardTop, null);
});

test('Section 4.3: favor against a target with empty hand succeeds without error', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.favor];
  s0.players[1].hand = []; // p2 không có bài

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'favor', target: 'p2' });
  assert.equal(s1.players[0].hand.length, 0);
  assert.equal(s1.players[1].hand.length, 0);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'favor',
    actor: 'p1',
    target: 'p2',
  });
});

test('E5: deterministic RNG produces reproducible game creation', () => {
  const rng1 = createMockRng([0.1, 0.5, 0.8, 0.3]);
  const rng2 = createMockRng([0.1, 0.5, 0.8, 0.3]);

  const game1 = createGame(['p1', 'p2'], rng1);
  const game2 = createGame(['p1', 'p2'], rng2);

  assert.deepEqual(game1.deck, game2.deck);
  assert.deepEqual(game1.players[0].hand, game2.players[0].hand);
  assert.deepEqual(game1.players[1].hand, game2.players[1].hand);
});
