/**
 * Mèo Nổ — Engine luật chơi (Phase 0)
 * Tuân thủ nghiêm ngặt đặc tả rules.md (Mục 2 và Mục 4).
 * Pure ES module, không I/O, không DOM, không network, không mutation.
 */

export const CARD = Object.freeze({
  boom: 'boom',
  defuse: 'defuse',
  attack: 'attack',
  skip: 'skip',
  shuffle: 'shuffle',
  favor: 'favor',
  peek: 'peek',
  cat: 'cat',
});

export class GameError extends Error {
  constructor(message, code = 'INVALID_ACTION') {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

/**
 * Xáo trộn mảng bằng thuật toán Fisher-Yates sử dụng rng được truyền vào.
 * Không thay đổi mảng ban đầu.
 */
function shuffle(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Tạo 29 lá bài thường theo Mục 4.1:
 * - 4 attack
 * - 4 skip
 * - 4 shuffle
 * - 4 favor
 * - 5 peek
 * - 8 cat
 */
function buildOrdinaryDeck() {
  const deck = [];
  for (let i = 0; i < 4; i++) deck.push(CARD.attack);
  for (let i = 0; i < 4; i++) deck.push(CARD.skip);
  for (let i = 0; i < 4; i++) deck.push(CARD.shuffle);
  for (let i = 0; i < 4; i++) deck.push(CARD.favor);
  for (let i = 0; i < 5; i++) deck.push(CARD.peek);
  for (let i = 0; i < 8; i++) deck.push(CARD.cat);
  return deck;
}

/**
 * Chuẩn hóa và kiểm tra danh sách người chơi.
 * Chấp nhận mảng string ID hoặc mảng object { id, name }.
 */
function normalizePlayers(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > 6) {
    throw new GameError('Số người chơi phải từ 2 đến 6', 'NEED_TWO_PLAYERS');
  }
  const seen = new Set();
  const players = [];
  for (const item of playerIds) {
    const id = typeof item === 'string' ? item : item?.id;
    const name = typeof item === 'object' && item?.name ? item.name : id;
    if (!id || typeof id !== 'string') {
      throw new GameError('ID người chơi không hợp lệ', 'INVALID_ACTION');
    }
    if (seen.has(id)) {
      throw new GameError(`ID người chơi bị trùng: ${id}`, 'INVALID_ACTION');
    }
    seen.add(id);
    players.push({ id, name, alive: true, hand: [] });
  }
  return players;
}

/**
 * Sao chép sâu state để bảo đảm tính thuần (purity E5).
 */
function cloneState(state) {
  return {
    version: state.version,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    turnsLeft: state.turnsLeft,
    pendingDefuseId: state.pendingDefuseId,
    winnerId: state.winnerId,
    deck: [...state.deck],
    discardPile: [...state.discardPile],
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      hand: [...p.hand],
    })),
    peek: state.peek
      ? { playerId: state.peek.playerId, cards: [...state.peek.cards] }
      : null,
    log: state.log.map(entry => ({ ...entry })),
  };
}

/**
 * Tìm người sống kế tiếp theo thứ tự vòng tròn ban đầu.
 */
function getNextLivingPlayerId(players, fromPlayerId) {
  const fromIndex = players.findIndex(p => p.id === fromPlayerId);
  if (fromIndex === -1) return null;
  const n = players.length;
  for (let step = 1; step < n; step++) {
    const candidate = players[(fromIndex + step) % n];
    if (candidate.alive) {
      return candidate.id;
    }
  }
  return null;
}

/**
 * Khởi tạo ván chơi mới theo Mục 4.1 và 4.2.
 * @param {Array<string|{id: string, name?: string}>} playerIds
 * @param {() => number} rng - Hàm trả về số ngẫu nhiên [0, 1)
 */
export function createGame(playerIds, rng = Math.random) {
  const players = normalizePlayers(playerIds);
  const n = players.length;

  // 1. Lấy phần bài thường (29 lá) và xáo kỹ
  const ordinaryPool = shuffle(buildOrdinaryDeck(), rng);

  // 2. Chia cho mỗi người 1 defuse + 4 lá thường
  for (const player of players) {
    player.hand = [CARD.defuse];
    for (let i = 0; i < 4; i++) {
      player.hand.push(ordinaryPool.pop());
    }
  }

  // 3. Bộ rút = phần thường còn lại + (n - 1) boom + 2 defuse, xáo kỹ
  const drawPile = [...ordinaryPool];
  for (let i = 0; i < n - 1; i++) {
    drawPile.push(CARD.boom);
  }
  for (let i = 0; i < 2; i++) {
    drawPile.push(CARD.defuse);
  }

  const shuffledDrawPile = shuffle(drawPile, rng);

  return {
    version: 0,
    phase: 'play',
    currentPlayerId: players[0].id,
    turnsLeft: 1,
    pendingDefuseId: null,
    winnerId: null,
    deck: shuffledDrawPile,
    discardPile: [],
    players,
    peek: null,
    log: [],
  };
}

/**
 * Loại người chơi khỏi ván theo Yêu cầu E3 và Mục 4.4, 4.6.
 * @param {object} state
 * @param {string} playerId
 * @param {'bomb'|'disconnect'|string} reason
 * @param {() => number} rng
 */
export function eliminatePlayer(state, playerId, reason = 'disconnect', _rng = Math.random) {
  if (state.phase === 'over') {
    return cloneState(state);
  }

  const next = cloneState(state);
  const player = next.players.find(p => p.id === playerId);
  if (!player) {
    throw new GameError('Người chơi không tồn tại', 'INVALID_ACTION');
  }
  if (!player.alive) {
    return next;
  }

  // Nếu đang ở pha defuse và người bị loại là pendingDefuse, hủy pha đó
  if (next.phase === 'defuse' && next.pendingDefuseId === playerId) {
    next.discardPile.push(CARD.boom);
    next.phase = 'play';
    next.pendingDefuseId = null;
  }

  player.alive = false;
  next.discardPile.push(...player.hand);
  player.hand = [];

  next.log.push({
    type: 'eliminated',
    actor: playerId,
    reason,
  });

  if (next.peek && next.peek.playerId === playerId) {
    next.peek = null;
  }

  const living = next.players.filter(p => p.alive);
  if (living.length <= 1) {
    next.phase = 'over';
    next.winnerId = living.length === 1 ? living[0].id : null;
    next.log.push({
      type: 'game_over',
      winnerId: next.winnerId,
    });
    next.version += 1;
    return next;
  }

  // Nếu người đó đang là người có lượt, chuyển lượt sang người sống kế tiếp và đặt turnsLeft = 1
  if (next.currentPlayerId === playerId) {
    next.currentPlayerId = getNextLivingPlayerId(next.players, playerId);
    next.turnsLeft = 1;
  }

  next.version += 1;
  return next;
}

/**
 * Thực hiện hành động của người chơi theo Mục 4.3 - 4.5.
 * @param {object} state
 * @param {string} playerId
 * @param {object} action
 * @param {() => number} rng
 */
export function applyAction(state, playerId, action, rng = Math.random) {
  if (!action || typeof action !== 'object') {
    throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
  }

  if (state.phase === 'over') {
    throw new GameError('Ván đã kết thúc', 'GAME_OVER');
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    throw new GameError('Người chơi không tồn tại', 'INVALID_ACTION');
  }
  if (!player.alive) {
    throw new GameError('Người chơi đã bị loại', 'INVALID_ACTION');
  }

  if (state.phase === 'defuse') {
    if (action.type !== 'defuse') {
      throw new GameError('Bạn đang phải gỡ bom', 'DEFUSE_PENDING');
    }
    if (playerId !== state.pendingDefuseId) {
      throw new GameError('Chưa đến lượt bạn', 'NOT_YOUR_TURN');
    }
  } else if (state.phase === 'play') {
    if (action.type === 'defuse') {
      throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
    }
    if (playerId !== state.currentPlayerId) {
      throw new GameError('Chưa đến lượt bạn', 'NOT_YOUR_TURN');
    }
  } else {
    throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
  }

  const next = cloneState(state);
  const current = next.players.find(p => p.id === playerId);

  // Peek sẽ ẩn khi người đánh thực hiện hành động tiếp theo
  if (next.peek && next.peek.playerId === playerId) {
    next.peek = null;
  }

  // 1. Rút bài (draw)
  if (action.type === 'draw') {
    if (next.deck.length === 0) {
      if (next.discardPile.length === 0) {
        // Cả hai đều trống: ván kết thúc không có người thắng
        next.phase = 'over';
        next.winnerId = null;
        next.log.push({ type: 'game_over', winnerId: null });
        next.version += 1;
        return next;
      }
      // Xáo lại bài đã đánh thành bộ rút mới
      next.deck = shuffle(next.discardPile, rng);
      next.discardPile = [];
      next.log.push({ type: 'deck_reshuffled' });
    }

    const drawnCard = next.deck.shift();

    if (drawnCard === CARD.boom) {
      next.log.push({ type: 'bomb_drawn', actor: playerId });
      const defuseIdx = current.hand.indexOf(CARD.defuse);

      if (defuseIdx !== -1) {
        // Có defuse: vào pha defuse
        next.phase = 'defuse';
        next.pendingDefuseId = playerId;
        next.version += 1;
        return next;
      }

      // Không có defuse: bị loại
      current.alive = false;
      next.discardPile.push(...current.hand, CARD.boom);
      current.hand = [];
      next.log.push({
        type: 'eliminated',
        actor: playerId,
        reason: 'bomb',
      });

      const living = next.players.filter(p => p.alive);
      if (living.length <= 1) {
        next.phase = 'over';
        next.winnerId = living.length === 1 ? living[0].id : null;
        next.log.push({
          type: 'game_over',
          winnerId: next.winnerId,
        });
        next.version += 1;
        return next;
      }

      next.currentPlayerId = getNextLivingPlayerId(next.players, playerId);
      next.turnsLeft = 1;
      next.version += 1;
      return next;
    }

    // Lá thường: vào tay, kết thúc 1 lượt rút
    current.hand.push(drawnCard);
    next.log.push({ type: 'draw', actor: playerId });

    next.turnsLeft -= 1;
    if (next.turnsLeft <= 0) {
      next.currentPlayerId = getNextLivingPlayerId(next.players, playerId);
      next.turnsLeft = 1;
    }

    next.version += 1;
    return next;
  }

  // 2. Gỡ bom (defuse)
  if (action.type === 'defuse') {
    const defuseIdx = current.hand.indexOf(CARD.defuse);
    if (defuseIdx === -1) {
      throw new GameError('Không có lá này trong tay', 'NO_CARD');
    }
    current.hand.splice(defuseIdx, 1);
    next.discardPile.push(CARD.defuse);

    let insertAt = action.insertAt ?? 0;
    if (typeof insertAt !== 'number' || Number.isNaN(insertAt)) {
      insertAt = 0;
    }
    insertAt = Math.floor(insertAt);
    if (insertAt < 0) insertAt = 0;
    if (insertAt > next.deck.length) insertAt = next.deck.length;

    next.deck.splice(insertAt, 0, CARD.boom);
    next.log.push({ type: 'defused', actor: playerId });

    next.phase = 'play';
    next.pendingDefuseId = null;

    next.turnsLeft -= 1;
    if (next.turnsLeft <= 0) {
      next.currentPlayerId = getNextLivingPlayerId(next.players, playerId);
      next.turnsLeft = 1;
    }

    next.version += 1;
    return next;
  }

  // 3. Chơi cặp mèo (catPair hoặc type 'cat' hoặc type 'play' với card 'cat')
  const isCatAction =
    action.type === 'catPair' ||
    action.type === 'cat' ||
    (action.type === 'play' && action.card === 'cat');

  if (isCatAction) {
    const catIndices = [];
    current.hand.forEach((c, idx) => {
      if (c === CARD.cat) catIndices.push(idx);
    });

    if (catIndices.length < 2) {
      throw new GameError('Không có lá này trong tay', 'NO_CARD');
    }

    const targetId = action.target;
    if (!targetId || targetId === playerId) {
      throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
    }
    const targetPlayer = next.players.find(p => p.id === targetId);
    if (!targetPlayer || !targetPlayer.alive) {
      throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
    }

    // Bỏ 2 lá mèo vào bài đã đánh
    current.hand.splice(catIndices[1], 1);
    current.hand.splice(catIndices[0], 1);
    next.discardPile.push(CARD.cat, CARD.cat);

    next.log.push({ type: 'cat', actor: playerId, target: targetId });

    if (targetPlayer.hand.length > 0) {
      const stealIdx = Math.floor(rng() * targetPlayer.hand.length);
      const [stolen] = targetPlayer.hand.splice(stealIdx, 1);
      current.hand.push(stolen);
    }

    next.version += 1;
    return next;
  }

  // 4. Đánh các lá thường đơn: skip, attack, shuffle, peek, favor
  const card = action.type === 'play' ? action.card : action.type;

  if (card === CARD.boom || card === CARD.defuse) {
    throw new GameError('Lá này không thể đánh riêng', 'INVALID_CARD');
  }

  if (![CARD.skip, CARD.attack, CARD.shuffle, CARD.peek, CARD.favor].includes(card)) {
    throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
  }

  const cardIdx = current.hand.indexOf(card);
  if (cardIdx === -1) {
    throw new GameError('Không có lá này trong tay', 'NO_CARD');
  }

  if (card === CARD.favor) {
    const targetId = action.target;
    if (!targetId || targetId === playerId) {
      throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
    }
    const targetPlayer = next.players.find(p => p.id === targetId);
    if (!targetPlayer || !targetPlayer.alive) {
      throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
    }

    current.hand.splice(cardIdx, 1);
    next.discardPile.push(CARD.favor);
    next.log.push({ type: 'favor', actor: playerId, target: targetId });

    if (targetPlayer.hand.length > 0) {
      const stealIdx = Math.floor(rng() * targetPlayer.hand.length);
      const [stolen] = targetPlayer.hand.splice(stealIdx, 1);
      current.hand.push(stolen);
    }

    next.version += 1;
    return next;
  }

  current.hand.splice(cardIdx, 1);
  next.discardPile.push(card);

  if (card === CARD.skip) {
    next.log.push({ type: 'skip', actor: playerId });
    next.turnsLeft -= 1;
    if (next.turnsLeft <= 0) {
      next.currentPlayerId = getNextLivingPlayerId(next.players, playerId);
      next.turnsLeft = 1;
    }
    next.version += 1;
    return next;
  }

  if (card === CARD.attack) {
    const nextPlayerId = getNextLivingPlayerId(next.players, playerId);
    next.log.push({ type: 'attack', actor: playerId, target: nextPlayerId });
    next.currentPlayerId = nextPlayerId;
    next.turnsLeft = 2 + (next.turnsLeft - 1);
    next.version += 1;
    return next;
  }

  if (card === CARD.shuffle) {
    next.log.push({ type: 'shuffle', actor: playerId });
    next.deck = shuffle(next.deck, rng);
    next.version += 1;
    return next;
  }

  if (card === CARD.peek) {
    next.log.push({ type: 'peek', actor: playerId });
    next.peek = {
      playerId,
      cards: next.deck.slice(0, 3),
    };
    next.version += 1;
    return next;
  }

  throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
}

/**
 * Trả về góc nhìn (view) của một người chơi theo Mục 6.6 và Yêu cầu E4.
 * Đảm bảo không lộ bài người khác, không lộ deck, không lộ peek người khác.
 * Không trả về chỉ số mảng cho currentPlayerId, pendingDefuseId, winnerId.
 * @param {object} state
 * @param {string} playerId
 */
export function viewFor(state, playerId) {
  const playersView = state.players.map(p => {
    const item = {
      id: p.id,
      name: p.name || p.id,
      alive: p.alive,
      handCount: p.hand.length,
    };
    if (p.id === playerId) {
      item.hand = [...p.hand];
    }
    return item;
  });

  const discardTop =
    state.discardPile.length > 0
      ? state.discardPile[state.discardPile.length - 1]
      : null;

  const peekView =
    state.peek && state.peek.playerId === playerId
      ? [...state.peek.cards]
      : null;

  return {
    version: state.version,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    turnsLeft: state.turnsLeft,
    pendingDefuseId: state.pendingDefuseId,
    winnerId: state.winnerId,
    deckCount: state.deck.length,
    discardCount: state.discardPile.length,
    discardTop,
    players: playersView,
    peek: peekView,
    log: state.log.map(entry => ({ ...entry })),
  };
}
