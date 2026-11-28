import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD,
  CAT_CARDS,
  GameError,
  MAX_PLAYERS,
  createGame,
  applyAction,
  eliminatePlayer,
  resolvePendingAction,
  hasEligibleNopeHolder,
  hasOtherLivingPlayer,
  getNextLivingPlayerId,
  viewFor,
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

/**
 * Đánh lá có thể bị Nope và tự động resolve (không có ai chặn).
 */
function playAndResolve(state, playerId, action, rng = Math.random) {
  const pending = applyAction(state, playerId, action, rng);
  if (pending.phase === 'nope') {
    return resolvePendingAction(pending, rng);
  }
  return pending;
}

// =============================================================================
// 1. API Exports và Constants
// =============================================================================

test('CARD: frozen object with all 12 card-type constants and CAT_CARDS', () => {
  assert.equal(Object.isFrozen(CARD), true);
  assert.equal(CARD.boom, 'boom');
  assert.equal(CARD.defuse, 'defuse');
  assert.equal(CARD.attack, 'attack');
  assert.equal(CARD.skip, 'skip');
  assert.equal(CARD.reverse, 'reverse');
  assert.equal(CARD.shuffle, 'shuffle');
  assert.equal(CARD.favor, 'favor');
  assert.equal(CARD.peek, 'peek');
  assert.equal(CARD.nope, 'nope');
  assert.equal(CARD.cat, 'cat');
  assert.equal(CARD.taco, 'taco');
  assert.equal(CARD.potato, 'potato');
  assert.equal(Object.keys(CARD).length, 12);

  assert.equal(Object.isFrozen(CAT_CARDS), true);
  assert.deepEqual(CAT_CARDS, [CARD.cat, CARD.taco, CARD.potato]);
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
// 2. Deck composition and counts (2..10 players)
// =============================================================================

test('Deck composition counts for 2 to 6 players (42 ordinary + n-1 boom + 2+n defuse)', () => {
  for (let n = 2; n <= 6; n++) {
    const playerIds = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    const game = createGame(playerIds);

    assert.equal(game.direction, 1);
    assert.equal(game.pendingAction, null);

    const allCards = [...game.deck];
    for (const p of game.players) {
      allCards.push(...p.hand);
    }

    const counts = {};
    for (const c of allCards) {
      counts[c] = (counts[c] || 0) + 1;
    }

    assert.equal(counts[CARD.boom], n - 1, `n=${n}: boom count`);
    assert.equal(counts[CARD.defuse], 2 + n, `n=${n}: defuse count`);
    assert.equal(counts[CARD.attack], 4, `n=${n}: attack count`);
    assert.equal(counts[CARD.skip], 4, `n=${n}: skip count`);
    assert.equal(counts[CARD.reverse], 4, `n=${n}: reverse count`);
    assert.equal(counts[CARD.shuffle], 4, `n=${n}: shuffle count`);
    assert.equal(counts[CARD.favor], 4, `n=${n}: favor count`);
    assert.equal(counts[CARD.peek], 5, `n=${n}: peek count`);
    assert.equal(counts[CARD.nope], 5, `n=${n}: nope count`);
    assert.equal(counts[CARD.cat], 4, `n=${n}: cat count`);
    assert.equal(counts[CARD.taco], 4, `n=${n}: taco count`);
    assert.equal(counts[CARD.potato], 4, `n=${n}: potato count`);

    const totalCards = 43 + 2 * n;
    assert.equal(allCards.length, totalCards, `n=${n}: total cards must be ${totalCards}`);
  }
});

test('Extended player count: scaled deck composition and dealing for 7 to 10 players', () => {
  const baseOrdinary = {
    [CARD.attack]: 4,
    [CARD.skip]: 4,
    [CARD.reverse]: 4,
    [CARD.shuffle]: 4,
    [CARD.favor]: 4,
    [CARD.peek]: 5,
    [CARD.nope]: 5,
    [CARD.cat]: 4,
    [CARD.taco]: 4,
    [CARD.potato]: 4,
  };

  for (let n = 7; n <= MAX_PLAYERS; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
    const game = createGame(ids, () => 0.5);
    assert.equal(game.players.length, n);
    for (const p of game.players) {
      assert.equal(p.hand.length, 5);
      assert.equal(p.hand.filter(c => c === CARD.defuse).length, 1);
      assert.equal(p.hand.filter(c => c === CARD.boom).length, 0);
    }

    const allCards = [...game.deck, ...game.players.flatMap(p => p.hand)];
    const counts = {};
    for (const c of allCards) {
      counts[c] = (counts[c] || 0) + 1;
    }

    assert.equal(counts[CARD.boom], n - 1);
    assert.equal(counts[CARD.defuse], 2 + n);

    const scale = n / 6;
    for (const [card, base] of Object.entries(baseOrdinary)) {
      let expected = Math.ceil(base * scale);
      if (CAT_CARDS.includes(card) && expected % 2 !== 0) {
        expected += 1;
      }
      assert.equal(counts[card], expected, `n=${n}: ${card} count`);
      if (CAT_CARDS.includes(card)) {
        assert.equal(counts[card] % 2, 0, `n=${n}: ${card} must be even`);
      }
    }
  }
});

// =============================================================================
// 3. Dealing rules and constraints
// =============================================================================

test('Dealing gives 1 defuse + 4 ordinary cards to each player', () => {
  const game = createGame(['p1', 'p2', 'p3']);
  for (const p of game.players) {
    assert.equal(p.hand.length, 5);
    assert.equal(p.hand.filter(c => c === CARD.defuse).length, 1);
    assert.equal(p.hand.filter(c => c === CARD.boom).length, 0);
  }

  assert.equal(game.deck.filter(c => c === CARD.defuse).length, 2);
  assert.equal(game.deck.filter(c => c === CARD.boom).length, 2);
});

test('Dealing rejects invalid player count (< 2 or > MAX_PLAYERS) and duplicate IDs', () => {
  assert.throws(
    () => createGame(['p1']),
    err => err instanceof GameError && err.code === 'NEED_TWO_PLAYERS'
  );
  assert.throws(
    () => createGame(Array.from({ length: 11 }, (_, i) => `p${i + 1}`)),
    err => err instanceof GameError && err.code === 'NEED_TWO_PLAYERS'
  );
  assert.throws(
    () => createGame(['p1', 'p1']),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );
});

// =============================================================================
// 4. Turn structure & Basic Cards
// =============================================================================

test('draw action ends turn immediately (cannot be Noped) and advances to next player', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck[0] = CARD.skip;
  const initialHandCount = s0.players[0].hand.length;

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'play');
  assert.equal(s1.pendingAction, null);
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.players[0].hand.length, initialHandCount + 1);
  assert.equal(s1.players[0].hand[s1.players[0].hand.length - 1], CARD.skip);
  assert.deepEqual(s1.log[s1.log.length - 1], { type: 'draw', actor: 'p1' });
});

test('skip action enters nope phase and upon resolve ends 1 turn without drawing', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.skip];
  const deckCountBefore = s0.deck.length;

  const sPending = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(sPending.phase, 'nope');
  assert.equal(sPending.discardPile[sPending.discardPile.length - 1], CARD.skip);
  assert.equal(sPending.players[0].hand.length, 0);

  const s1 = resolvePendingAction(sPending);
  assert.equal(s1.phase, 'play');
  assert.equal(s1.pendingAction, null);
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.deck.length, deckCountBefore);
  assert.deepEqual(s1.log[s1.log.length - 1], { type: 'skip', actor: 'p1' });
});

test('skip when turnsLeft > 1 reduces turnsLeft by 1 and keeps turn', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.turnsLeft = 2;
  s0.players[0].hand = [CARD.skip, CARD.skip];

  const s1 = playAndResolve(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s1.currentPlayerId, 'p1');
  assert.equal(s1.turnsLeft, 1);

  const s2 = playAndResolve(s1, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s2.currentPlayerId, 'p2');
  assert.equal(s2.turnsLeft, 1);
});

test('attack gives next player 2 + (turnsLeft - 1) turns (stacking)', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.attack];
  s0.turnsLeft = 1;

  const s1 = playAndResolve(s0, 'p1', { type: 'play', card: 'attack' });
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 2);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'attack',
    actor: 'p1',
    target: 'p2',
  });

  s1.players[1].hand = [CARD.attack];
  const s2 = playAndResolve(s1, 'p2', { type: 'play', card: 'attack' });
  assert.equal(s2.currentPlayerId, 'p1');
  assert.equal(s2.turnsLeft, 3);
});

test('shuffle, peek, favor, catPair do not end the turn when resolved', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [
    CARD.shuffle,
    CARD.peek,
    CARD.favor,
    CARD.cat,
    CARD.cat,
  ];
  s0.players[1].hand = [CARD.defuse, CARD.skip];

  const s1 = playAndResolve(s0, 'p1', { type: 'play', card: 'shuffle' });
  assert.equal(s1.currentPlayerId, 'p1');
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.log[s1.log.length - 1].type, 'shuffle');

  const s2 = playAndResolve(s1, 'p1', { type: 'play', card: 'peek' });
  assert.equal(s2.currentPlayerId, 'p1');
  assert.equal(s2.turnsLeft, 1);
  assert.equal(s2.log[s2.log.length - 1].type, 'peek');
  assert.equal(s2.peek.cards.length, 3);

  const p1HandBeforeFavor = s2.players[0].hand.length;
  const p2HandBeforeFavor = s2.players[1].hand.length;
  const s3 = playAndResolve(s2, 'p1', { type: 'play', card: 'favor', target: 'p2' });
  assert.equal(s3.currentPlayerId, 'p1');
  assert.equal(s3.players[0].hand.length, p1HandBeforeFavor);
  assert.equal(s3.players[1].hand.length, p2HandBeforeFavor - 1);
  assert.deepEqual(s3.log[s3.log.length - 1], {
    type: 'favor',
    actor: 'p1',
    target: 'p2',
  });

  const p1HandBeforeCat = s3.players[0].hand.length;
  const p2HandBeforeCat = s3.players[1].hand.length;
  const s4 = playAndResolve(s3, 'p1', { type: 'catPair', target: 'p2' });
  assert.equal(s4.currentPlayerId, 'p1');
  assert.equal(s4.players[0].hand.length, p1HandBeforeCat - 1);
  assert.equal(s4.players[1].hand.length, p2HandBeforeCat - 1);
  assert.deepEqual(s4.log[s4.log.length - 1], {
    type: 'cat',
    card: CARD.cat,
    actor: 'p1',
    target: 'p2',
  });
});

// =============================================================================
// 5. Reverse & Direction tests
// =============================================================================

test('getNextLivingPlayerId respects direction 1 and -1 and skips dead players', () => {
  const players = [
    { id: 'p1', alive: true },
    { id: 'p2', alive: false },
    { id: 'p3', alive: true },
    { id: 'p4', alive: true },
  ];
  assert.equal(getNextLivingPlayerId(players, 'p1', 1), 'p3');
  assert.equal(getNextLivingPlayerId(players, 'p1', -1), 'p4');
  assert.equal(getNextLivingPlayerId(players, 'p3', -1), 'p1');
  assert.equal(getNextLivingPlayerId(players, 'p4', 1), 'p1');
});

test('reverse in 2-player game flips direction and ends 1 turn', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.reverse];
  s0.players[1].hand = [CARD.reverse];

  const s1 = playAndResolve(s0, 'p1', { type: 'play', card: 'reverse' });
  assert.equal(s1.direction, -1);
  assert.equal(s1.currentPlayerId, 'p2');
  assert.equal(s1.turnsLeft, 1);
  assert.deepEqual(s1.log[s1.log.length - 1], {
    type: 'reverse',
    actor: 'p1',
    direction: -1,
  });

  const s2 = playAndResolve(s1, 'p2', { type: 'play', card: 'reverse' });
  assert.equal(s2.direction, 1);
  assert.equal(s2.currentPlayerId, 'p1');
  assert.equal(s2.turnsLeft, 1);
});

test('reverse in 4-player game flips turn order for draw, skip, attack, defuse, and eliminatePlayer', () => {
  let s = createGame(['p1', 'p2', 'p3', 'p4']);
  s.players[0].hand = [CARD.reverse];
  s.players[3].hand = [CARD.skip];
  s.players[2].hand = [CARD.attack];
  s.players[1].hand = [CARD.defuse];

  // p1 plays reverse: direction 1 -> -1, turn goes p1 -> p4
  s = playAndResolve(s, 'p1', { type: 'play', card: 'reverse' });
  assert.equal(s.direction, -1);
  assert.equal(s.currentPlayerId, 'p4');

  // p4 plays skip: turn goes p4 -> p3
  s = playAndResolve(s, 'p4', { type: 'play', card: 'skip' });
  assert.equal(s.currentPlayerId, 'p3');

  // p3 plays attack: target in direction -1 is p2 with 2 turns
  s = playAndResolve(s, 'p3', { type: 'play', card: 'attack' });
  assert.equal(s.currentPlayerId, 'p2');
  assert.equal(s.turnsLeft, 2);

  // p2 draws boom -> defuses -> still has 1 turn left, then draws safe card -> turn goes p2 -> p1
  s.deck = [CARD.boom, CARD.skip, CARD.skip];
  s = applyAction(s, 'p2', { type: 'draw' });
  assert.equal(s.phase, 'defuse');
  s = applyAction(s, 'p2', { type: 'defuse', insertAt: 2 });
  assert.equal(s.currentPlayerId, 'p2');
  assert.equal(s.turnsLeft, 1);

  s = applyAction(s, 'p2', { type: 'draw' });
  assert.equal(s.currentPlayerId, 'p1');

  // eliminatePlayer while p1 has turn in direction -1 advances to p4
  s = eliminatePlayer(s, 'p1', 'disconnect');
  assert.equal(s.currentPlayerId, 'p4');
});

test('reverse when turnsLeft > 1 flips direction, decrements turnsLeft, and keeps current player', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.turnsLeft = 2;
  s0.players[0].hand = [CARD.reverse];

  const s1 = playAndResolve(s0, 'p1', { type: 'play', card: 'reverse' });
  assert.equal(s1.direction, -1);
  assert.equal(s1.turnsLeft, 1);
  assert.equal(s1.currentPlayerId, 'p1');
});

// =============================================================================
// 6. Nope rules: cancel, double-nope (Yup), passNope, hasEligibleNopeHolder
// =============================================================================

test('nope cancels every Nope-able action (skip, attack, reverse, shuffle, peek, favor, catPair)', () => {
  const cases = [
    {
      name: 'skip',
      hand: [CARD.skip],
      action: { type: 'play', card: 'skip' },
      check: (before, after) => {
        assert.equal(after.currentPlayerId, 'p1');
        assert.equal(after.turnsLeft, before.turnsLeft);
      },
    },
    {
      name: 'attack',
      hand: [CARD.attack],
      action: { type: 'play', card: 'attack' },
      check: (before, after) => {
        assert.equal(after.currentPlayerId, 'p1');
        assert.equal(after.turnsLeft, before.turnsLeft);
      },
    },
    {
      name: 'reverse',
      hand: [CARD.reverse],
      action: { type: 'play', card: 'reverse' },
      check: (before, after) => {
        assert.equal(after.direction, 1);
        assert.equal(after.currentPlayerId, 'p1');
      },
    },
    {
      name: 'shuffle',
      hand: [CARD.shuffle],
      action: { type: 'play', card: 'shuffle' },
      check: (before, after) => {
        assert.deepEqual(after.deck, before.deck);
      },
    },
    {
      name: 'peek',
      hand: [CARD.peek],
      action: { type: 'play', card: 'peek' },
      check: (_before, after) => {
        assert.equal(after.peek, null);
      },
    },
    {
      name: 'favor',
      hand: [CARD.favor],
      action: { type: 'play', card: 'favor', target: 'p2' },
      check: (_before, after) => {
        assert.equal(after.players[0].hand.length, 0);
        assert.deepEqual(after.players[1].hand, [CARD.defuse]);
      },
    },
    {
      name: 'catPair',
      hand: [CARD.taco, CARD.taco],
      action: { type: 'catPair', card: CARD.taco, target: 'p2' },
      check: (_before, after) => {
        assert.equal(after.players[0].hand.length, 0);
        assert.deepEqual(after.players[1].hand, [CARD.defuse]);
      },
    },
  ];

  for (const tc of cases) {
    const s0 = createGame(['p1', 'p2']);
    s0.players[0].hand = [...tc.hand];
    s0.players[1].hand = [CARD.defuse, CARD.nope];
    s0.deck = [CARD.skip, CARD.attack, CARD.peek, CARD.favor];

    const s1 = applyAction(s0, 'p1', tc.action);
    assert.equal(s1.phase, 'nope', `${tc.name}: enters nope phase`);

    const s2 = applyAction(s1, 'p2', { type: 'nope' });
    assert.equal(s2.pendingAction.nopeCount, 1);
    assert.equal(s2.pendingAction.lastActorId, 'p2');
    assert.deepEqual(s2.log[s2.log.length - 1], {
      type: 'nope',
      actor: 'p2',
      card: s1.pendingAction.card,
      count: 1,
    });

    // p2 removed nope from hand
    const s3 = applyAction(s2, 'p1', { type: 'passNope' });
    assert.equal(s3.phase, 'play', `${tc.name}: resolved via passNope`);
    assert.equal(s3.pendingAction, null);
    assert.deepEqual(s3.log[s3.log.length - 1], {
      type: 'action_cancelled',
      actor: 'p1',
      card: s1.pendingAction.card,
    });
    tc.check(s0, s3);
  }
});

test('double nope ("Yup") restores original action execution, triple nope cancels again', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.attack, CARD.nope];
  s0.players[1].hand = [CARD.nope];
  s0.players[2].hand = [CARD.nope];

  // p1 plays attack
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'attack' });
  // p2 nopes (count=1)
  const s2 = applyAction(s1, 'p2', { type: 'play', card: 'nope' });
  assert.equal(s2.pendingAction.nopeCount, 1);
  // p1 nopes back -> Yup! (count=2)
  const s3 = applyAction(s2, 'p1', { type: 'nope' });
  assert.equal(s3.pendingAction.nopeCount, 2);
  assert.equal(s3.pendingAction.lastActorId, 'p1');
  assert.deepEqual(s3.pendingAction.passedIds, []);

  // Resolve at count=2 -> attack executes!
  const sYup = resolvePendingAction(s3);
  assert.equal(sYup.phase, 'play');
  assert.equal(sYup.currentPlayerId, 'p2');
  assert.equal(sYup.turnsLeft, 2);

  // Or if p3 nopes s3 (count=3) -> cancelled again!
  const s4 = applyAction(s3, 'p3', { type: 'nope' });
  assert.equal(s4.pendingAction.nopeCount, 3);
  const sCancelled = resolvePendingAction(s4);
  assert.equal(sCancelled.phase, 'play');
  assert.equal(sCancelled.currentPlayerId, 'p1');
  assert.equal(sCancelled.turnsLeft, 1);
  assert.equal(sCancelled.log[sCancelled.log.length - 1].type, 'action_cancelled');
});

test('nope constraints: cannot self-nope, cannot play nope in play phase, cannot nope draw/defuse', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.nope, CARD.skip, CARD.defuse];
  s0.players[1].hand = [CARD.nope];
  s0.deck = [CARD.boom, CARD.skip];

  // Cannot play nope during phase === 'play'
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'nope' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'nope' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );

  // p1 plays skip -> enters nope phase
  const sNope = applyAction(s0, 'p1', { type: 'play', card: 'skip' });

  // p1 cannot self-nope or self-passNope
  assert.throws(
    () => applyAction(sNope, 'p1', { type: 'nope' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );
  assert.throws(
    () => applyAction(sNope, 'p1', { type: 'passNope' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );

  // Cannot play draw or skip during nope phase
  assert.throws(
    () => applyAction(sNope, 'p2', { type: 'draw' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );

  // draw bomb -> enters defuse phase directly (cannot be Noped)
  const sBomb = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(sBomb.phase, 'defuse');
  assert.equal(sBomb.pendingAction, null);

  // defuse -> resolves directly to play phase (cannot be Noped)
  const sDefused = applyAction(sBomb, 'p1', { type: 'defuse', insertAt: 0 });
  assert.equal(sDefused.phase, 'play');
  assert.equal(sDefused.pendingAction, null);
});

test('passNope waits until all alive players != lastActorId pass, then resolves in 1 version bump', () => {
  const s0 = createGame(['p1', 'p2', 'p3', 'p4']);
  s0.players[0].hand = [CARD.skip];
  s0.players[3].alive = false; // p4 is dead so doesn't need to pass

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  const v1 = s1.version;

  // p2 passes -> p3 hasn't passed yet, stays in nope phase
  const s2 = applyAction(s1, 'p2', { type: 'passNope' });
  assert.equal(s2.phase, 'nope');
  assert.deepEqual(s2.pendingAction.passedIds, ['p2']);
  assert.equal(s2.version, v1 + 1);

  // Duplicate passNope from p2 does not resolve early
  const s2dup = applyAction(s2, 'p2', { type: 'passNope' });
  assert.equal(s2dup.phase, 'nope');
  assert.deepEqual(s2dup.pendingAction.passedIds, ['p2']);

  // p3 passes -> all alive players != p1 have passed -> resolves immediately!
  const s3 = applyAction(s2dup, 'p3', { type: 'passNope' });
  assert.equal(s3.phase, 'play');
  assert.equal(s3.pendingAction, null);
  assert.equal(s3.currentPlayerId, 'p2');
  assert.equal(s3.version, s2dup.version + 1);
});

test('resolveNope action resolves pendingAction, and resolvePendingAction throws outside nope phase', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  assert.throws(
    () => resolvePendingAction(s0),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );

  s0.players[0].hand = [CARD.skip];
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  const s2 = applyAction(s1, 'p2', { type: 'resolveNope' });
  assert.equal(s2.phase, 'play');
  assert.equal(s2.currentPlayerId, 'p2');
});

test('hasEligibleNopeHolder returns true iff another alive player holds nope', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.skip, CARD.nope];
  s0.players[1].hand = [CARD.cat];
  s0.players[2].hand = [CARD.nope];

  // Not in nope phase -> false
  assert.equal(hasEligibleNopeHolder(s0), false);

  // Enter nope phase (p1 is lastActorId; p3 is alive and holds nope -> true)
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(hasEligibleNopeHolder(s1), true);

  // If p3 is eliminated, only p1 (lastActorId) holds nope -> false
  const s2 = eliminatePlayer(s1, 'p3', 'disconnect');
  assert.equal(hasEligibleNopeHolder(s2), false);
});

test('hasOtherLivingPlayer checks only alive players != lastActorId without inspecting hands', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.skip];
  s0.players[1].hand = [CARD.cat]; // no nope in opponent hand

  // Not in nope phase -> false
  assert.equal(hasOtherLivingPlayer(s0), false);

  // Enter nope phase: p2 has 0 nope cards, yet hasOtherLivingPlayer is still true (zero hand leak)
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(hasEligibleNopeHolder(s1), false);
  assert.equal(hasOtherLivingPlayer(s1), true);

  // If no other living player exists beside lastActorId -> false
  const noOtherAlive = {
    ...s1,
    players: s1.players.map(p => (p.id === 'p1' ? p : { ...p, alive: false })),
  };
  assert.equal(hasOtherLivingPlayer(noOtherAlive), false);
});

// =============================================================================
// 7. Cat, Taco, Potato pair rules
// =============================================================================

test('taco and potato pairs work, auto-selection works, and mixed pairs or single plays are rejected', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.players[0].hand = [CARD.cat, CARD.taco, CARD.potato];
  s0.players[1].hand = [CARD.defuse, CARD.skip];

  // Single cat/taco/potato cannot be played via play
  for (const breed of CAT_CARDS) {
    assert.throws(
      () => applyAction(s0, 'p1', { type: 'play', card: breed }),
      err => err instanceof GameError && err.code === 'INVALID_CARD'
    );
  }

  // Mixing 1 taco + 1 potato is rejected
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', target: 'p2' }),
    err => err instanceof GameError && err.code === 'NO_CARD'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', card: CARD.taco, target: 'p2' }),
    err => err instanceof GameError && err.code === 'NO_CARD'
  );

  // Invalid card in catPair throws INVALID_ACTION
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', card: CARD.skip, target: 'p2' }),
    err => err instanceof GameError && err.code === 'INVALID_ACTION'
  );

  // Valid taco pair (explicit card)
  const sTaco = createGame(['p1', 'p2']);
  sTaco.players[0].hand = [CARD.taco, CARD.taco, CARD.potato];
  sTaco.players[1].hand = [CARD.attack];
  const sTacoRes = playAndResolve(
    sTaco,
    'p1',
    { type: 'catPair', card: CARD.taco, target: 'p2' },
    createMockRng([0])
  );
  assert.deepEqual(sTacoRes.players[0].hand, [CARD.potato, CARD.attack]);
  assert.deepEqual(sTacoRes.discardPile, [CARD.taco, CARD.taco]);
  assert.deepEqual(sTacoRes.log[sTacoRes.log.length - 1], {
    type: 'cat',
    card: CARD.taco,
    actor: 'p1',
    target: 'p2',
  });

  // Valid potato pair (omitted card -> picks potato automatically)
  const sPotato = createGame(['p1', 'p2']);
  sPotato.players[0].hand = [CARD.cat, CARD.potato, CARD.potato];
  sPotato.players[1].hand = [CARD.peek];
  const sPotatoRes = playAndResolve(
    sPotato,
    'p1',
    { type: 'catPair', target: 'p2' },
    createMockRng([0])
  );
  assert.deepEqual(sPotatoRes.players[0].hand, [CARD.cat, CARD.peek]);
  assert.deepEqual(sPotatoRes.discardPile, [CARD.potato, CARD.potato]);
  assert.deepEqual(sPotatoRes.log[sPotatoRes.log.length - 1], {
    type: 'cat',
    card: CARD.potato,
    actor: 'p1',
    target: 'p2',
  });
});

// =============================================================================
// 8. Bomb, Defuse, and Game Over
// =============================================================================

test('drawing a bomb with defuse enters defuse phase and clamps insertAt', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom, CARD.skip, CARD.attack];
  s0.players[0].hand = [CARD.defuse];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'defuse');
  assert.equal(s1.pendingDefuseId, 'p1');

  assert.throws(
    () => applyAction(s1, 'p1', { type: 'draw' }),
    err => err instanceof GameError && err.code === 'DEFUSE_PENDING'
  );
  assert.throws(
    () => applyAction(s1, 'p2', { type: 'defuse', insertAt: 0 }),
    err => err instanceof GameError && err.code === 'NOT_YOUR_TURN'
  );

  const s2 = applyAction(s1, 'p1', { type: 'defuse', insertAt: 1 });
  assert.equal(s2.phase, 'play');
  assert.equal(s2.pendingDefuseId, null);
  assert.equal(s2.deck[1], CARD.boom);
  assert.equal(s2.currentPlayerId, 'p2');

  // Clamp < 0 -> 0 and > deck.length -> end
  s2.deck = [CARD.boom, CARD.skip];
  s2.players[1].hand = [CARD.defuse];
  const s3 = applyAction(s2, 'p2', { type: 'draw' });
  const s4 = applyAction(s3, 'p2', { type: 'defuse', insertAt: 999 });
  assert.equal(s4.deck[s4.deck.length - 1], CARD.boom);
});

test('drawing a bomb without defuse eliminates player and ends game when 1 remains', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom];
  s0.players[0].hand = [];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.phase, 'over');
  assert.equal(s1.winnerId, 'p2');
  assert.throws(
    () => applyAction(s1, 'p2', { type: 'draw' }),
    err => err instanceof GameError && err.code === 'GAME_OVER'
  );
});

test('reshuffle discard into draw pile or end game if both empty', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [];
  s0.discardPile = [CARD.skip, CARD.attack, CARD.shuffle];
  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  assert.equal(s1.deck.length, 2);
  assert.equal(s1.discardPile.length, 0);
  assert.equal(s1.log.some(e => e.type === 'deck_reshuffled'), true);

  const empty = createGame(['p1', 'p2']);
  empty.deck = [];
  empty.discardPile = [];
  const over = applyAction(empty, 'p1', { type: 'draw' });
  assert.equal(over.phase, 'over');
  assert.equal(over.winnerId, null);
});

test('cannot play boom/defuse singly or target self/dead player', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.boom, CARD.defuse, CARD.favor, CARD.cat, CARD.cat];
  s0.players[2].alive = false;

  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'boom' }),
    err => err instanceof GameError && err.code === 'INVALID_CARD'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'defuse' }),
    err => err instanceof GameError && err.code === 'INVALID_CARD'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'favor', target: 'p1' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'play', card: 'favor', target: 'p3' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );
  assert.throws(
    () => applyAction(s0, 'p1', { type: 'catPair', target: 'p3' }),
    err => err instanceof GameError && err.code === 'INVALID_TARGET'
  );
});

// =============================================================================
// 9. eliminatePlayer during nope & defuse
// =============================================================================

test('eliminatePlayer cancels pendingAction if actor disconnects during nope phase', () => {
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.direction = -1;
  s0.players[0].hand = [CARD.skip];

  const sNope = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(sNope.phase, 'nope');

  const sAfter = eliminatePlayer(sNope, 'p1', 'disconnect');
  assert.equal(sAfter.phase, 'play');
  assert.equal(sAfter.pendingAction, null);
  assert.equal(sAfter.currentPlayerId, 'p3'); // direction -1 from p1 -> p3
  assert.equal(sAfter.turnsLeft, 1);
});

test('eliminatePlayer during nope resolves if all remaining eligible players already passed, and skips dead target steal', () => {
  // Case A: p2 passed, p3 disconnects -> only p2 left != p1 and p2 already passed -> resolves!
  const s0 = createGame(['p1', 'p2', 'p3']);
  s0.players[0].hand = [CARD.skip];
  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  const s2 = applyAction(s1, 'p2', { type: 'passNope' });
  assert.equal(s2.phase, 'nope');

  const s3 = eliminatePlayer(s2, 'p3', 'disconnect');
  assert.equal(s3.phase, 'play');
  assert.equal(s3.pendingAction, null);
  assert.equal(s3.currentPlayerId, 'p2');

  // Case B: target disconnects before resolve -> pendingAction kept, resolves without stealing
  const f0 = createGame(['p1', 'p2', 'p3']);
  f0.players[0].hand = [CARD.favor];
  f0.players[1].hand = [CARD.defuse];
  const f1 = applyAction(f0, 'p1', { type: 'play', card: 'favor', target: 'p2' });
  const f2 = eliminatePlayer(f1, 'p2', 'disconnect');
  assert.equal(f2.phase, 'nope');
  const f3 = resolvePendingAction(f2);
  assert.equal(f3.phase, 'play');
  assert.equal(f3.players[0].hand.length, 0); // p2 is dead, nothing stolen
});

test('eliminatePlayer cancels pending defuse phase if target is pendingDefuse', () => {
  const s0 = createGame(['p1', 'p2']);
  s0.deck = [CARD.boom];
  s0.players[0].hand = [CARD.defuse];

  const s1 = applyAction(s0, 'p1', { type: 'draw' });
  const s2 = eliminatePlayer(s1, 'p1', 'disconnect');
  assert.equal(s2.phase, 'over');
  assert.equal(s2.pendingDefuseId, null);
  assert.ok(s2.discardPile.includes(CARD.boom));
  assert.equal(s2.winnerId, 'p2');
});

// =============================================================================
// 10. viewFor & Purity checks
// =============================================================================

test('viewFor exposes direction and pendingAction without leaking hands, deck, or other peeks', () => {
  let state = createGame(['p1', 'p2', 'p3']);
  state.players[0].hand = [CARD.defuse, CARD.peek, CARD.skip];
  state.players[1].hand = [CARD.attack, CARD.nope];
  state.deck = [CARD.cat, CARD.shuffle, CARD.boom];

  // Peek resolved
  state = playAndResolve(state, 'p1', { type: 'play', card: 'peek' });
  const viewP1Peek = viewFor(state, 'p1');
  assert.equal(viewP1Peek.direction, 1);
  assert.equal(viewP1Peek.pendingAction, null);
  assert.equal(viewP1Peek.deck, undefined);
  assert.deepEqual(viewP1Peek.peek, [CARD.cat, CARD.shuffle, CARD.boom]);
  assert.equal(viewP1Peek.players[1].hand, undefined);
  assert.equal(viewP1Peek.players[1].handCount, 2);

  const viewP2Peek = viewFor(state, 'p2');
  assert.equal(viewP2Peek.peek, null);

  // Enter nope phase with passedIds
  state = applyAction(state, 'p1', { type: 'play', card: 'skip' });
  state = applyAction(state, 'p2', { type: 'passNope' });
  const viewDuringNope = viewFor(state, 'p3');
  assert.deepEqual(viewDuringNope.pendingAction, {
    type: 'play',
    card: CARD.skip,
    actor: 'p1',
    target: null,
    nopeCount: 0,
    lastActorId: 'p1',
    passedIds: ['p2'],
  });

  // Mutating viewDuringNope.pendingAction.passedIds must not mutate state
  viewDuringNope.pendingAction.passedIds.push('p3');
  assert.deepEqual(state.pendingAction.passedIds, ['p2']);
});

test('E5: purity - applyAction, resolvePendingAction, eliminatePlayer, viewFor never mutate input state', () => {
  const playerIds = ['p1', 'p2', 'p3'];
  const original = createGame(playerIds);
  original.players[0].hand = [CARD.skip];
  original.players[1].hand = [CARD.nope];

  const sNope = applyAction(original, 'p1', { type: 'play', card: 'skip' });
  const serialized = JSON.stringify(sNope);

  applyAction(sNope, 'p2', { type: 'nope' });
  assert.equal(JSON.stringify(sNope), serialized, 'applyAction(nope) mutated input');

  applyAction(sNope, 'p2', { type: 'passNope' });
  assert.equal(JSON.stringify(sNope), serialized, 'applyAction(passNope) mutated input');

  resolvePendingAction(sNope);
  assert.equal(JSON.stringify(sNope), serialized, 'resolvePendingAction mutated input');

  eliminatePlayer(sNope, 'p3', 'disconnect');
  assert.equal(JSON.stringify(sNope), serialized, 'eliminatePlayer mutated input');

  viewFor(sNope, 'p1');
  assert.equal(JSON.stringify(sNope), serialized, 'viewFor mutated input');
});

test('E1 & E2: version increments by 1 on each valid step and stays unchanged on error', () => {
  const s0 = createGame(['p1', 'p2']);
  assert.equal(s0.version, 0);
  s0.players[0].hand = [CARD.skip];
  s0.players[1].hand = [CARD.nope];

  const s1 = applyAction(s0, 'p1', { type: 'play', card: 'skip' });
  assert.equal(s1.version, 1);

  const s2 = applyAction(s1, 'p2', { type: 'nope' });
  assert.equal(s2.version, 2);

  assert.throws(() => applyAction(s2, 'p2', { type: 'nope' }));
  assert.equal(s2.version, 2);

  const s3 = resolvePendingAction(s2);
  assert.equal(s3.version, 3);
});
