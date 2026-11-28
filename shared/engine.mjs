/**
 * Mèo Nổ — Engine luật chơi (Phase 0 + Reverse/Nope/Taco/Potato)
 * Tuân thủ nghiêm ngặt đặc tả rules.md (Mục 2 và Mục 4).
 * Pure ES module, không I/O, không DOM, không network, không mutation.
 */

export const CARD = Object.freeze({
  boom: 'boom',
  defuse: 'defuse',
  attack: 'attack',
  skip: 'skip',
  reverse: 'reverse',
  shuffle: 'shuffle',
  favor: 'favor',
  peek: 'peek',
  nope: 'nope',
  cat: 'cat',
  taco: 'taco',
  potato: 'potato',
});

export const CAT_CARDS = Object.freeze([CARD.cat, CARD.taco, CARD.potato]);

const NOPEABLE_SINGLE_CARDS = Object.freeze([
  CARD.skip,
  CARD.attack,
  CARD.reverse,
  CARD.shuffle,
  CARD.peek,
  CARD.favor,
]);

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
 * Số lượng gốc của mỗi loại lá thường cho <= 6 người (42 lá thường):
 * 4 attack, 4 skip, 4 reverse, 4 shuffle, 4 favor, 5 peek, 5 nope,
 * 4 cat, 4 taco, 4 potato.
 */
const BASE_PLAYER_COUNT = 6;
const BASE_ORDINARY_COUNTS = Object.freeze({
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
});

/**
 * Tạo bộ lá thường, tỉ lệ theo số người chơi `n`.
 * Với n <= 6, trả về đúng 42 lá thường.
 * Với n > 6 (7..MAX_PLAYERS), nhân tỉ lệ theo n/6 (làm tròn lên).
 * Các lá trong CAT_CARDS luôn làm tròn lên số chẵn vì được đánh theo cặp.
 *
 * @param {number} n - Số người chơi (2..MAX_PLAYERS)
 */
function buildOrdinaryDeck(n = BASE_PLAYER_COUNT) {
  const scale = n > BASE_PLAYER_COUNT ? n / BASE_PLAYER_COUNT : 1;
  const deck = [];
  for (const [type, base] of Object.entries(BASE_ORDINARY_COUNTS)) {
    let count = Math.ceil(base * scale);
    if (CAT_CARDS.includes(type) && count % 2 !== 0) count += 1;
    for (let i = 0; i < count; i++) deck.push(type);
  }
  return deck;
}

/**
 * Chuẩn hóa và kiểm tra danh sách người chơi.
 * Chấp nhận mảng string ID hoặc mảng object { id, name }.
 */
export const MAX_PLAYERS = 10;

function normalizePlayers(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > MAX_PLAYERS) {
    throw new GameError(`Số người chơi phải từ 2 đến ${MAX_PLAYERS}`, 'NEED_TWO_PLAYERS');
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
    direction: state.direction ?? 1,
    pendingDefuseId: state.pendingDefuseId,
    pendingAction: state.pendingAction
      ? {
          type: state.pendingAction.type,
          card: state.pendingAction.card,
          actor: state.pendingAction.actor,
          target: state.pendingAction.target ?? null,
          nopeCount: state.pendingAction.nopeCount,
          lastActorId: state.pendingAction.lastActorId,
          passedIds: [...(state.pendingAction.passedIds ?? [])],
        }
      : null,
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
 * Tìm người sống kế tiếp theo chiều `direction` (1 = xuôi, -1 = ngược).
 */
export function getNextLivingPlayerId(players, fromPlayerId, direction = 1) {
  const fromIndex = players.findIndex(p => p.id === fromPlayerId);
  if (fromIndex === -1) return null;
  const n = players.length;
  for (let step = 1; step < n; step++) {
    const candidate = players[(fromIndex + direction * step + n * step) % n];
    if (candidate.alive) {
      return candidate.id;
    }
  }
  return null;
}

/**
 * Kiểm tra mục tiêu hợp lệ (còn sống và không phải chính người đánh).
 */
function validateTarget(players, playerId, targetId) {
  if (!targetId || targetId === playerId) {
    throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
  }
  const targetPlayer = players.find(p => p.id === targetId);
  if (!targetPlayer || !targetPlayer.alive) {
    throw new GameError('Mục tiêu không hợp lệ', 'INVALID_TARGET');
  }
  return targetPlayer;
}

/**
 * Cướp ngẫu nhiên 1 lá từ tay targetPlayer sang actorPlayer nếu cả hai còn sống và target có bài.
 */
function stealRandomCard(actorPlayer, targetPlayer, rng) {
  if (
    actorPlayer &&
    actorPlayer.alive &&
    targetPlayer &&
    targetPlayer.alive &&
    targetPlayer.hand.length > 0
  ) {
    const stealIdx = Math.floor(rng() * targetPlayer.hand.length);
    const [stolen] = targetPlayer.hand.splice(stealIdx, 1);
    actorPlayer.hand.push(stolen);
  }
}

/**
 * Giảm turnsLeft và chuyển lượt theo direction nếu turnsLeft về 0.
 */
function advanceTurnOrKeep(next, fromPlayerId) {
  next.turnsLeft -= 1;
  if (next.turnsLeft <= 0) {
    next.currentPlayerId = getNextLivingPlayerId(
      next.players,
      fromPlayerId,
      next.direction ?? 1
    );
    next.turnsLeft = 1;
  }
}

/**
 * Giải quyết pendingAction trực tiếp trên bản sao `next` (không tự tăng version).
 */
function resolvePendingInPlace(next, rng) {
  const pending = next.pendingAction;
  next.phase = 'play';
  next.pendingAction = null;

  if (pending.nopeCount % 2 === 1) {
    next.log.push({
      type: 'action_cancelled',
      actor: pending.actor,
      card: pending.card,
    });
    return;
  }

  const actorPlayer = next.players.find(p => p.id === pending.actor);
  const dir = next.direction ?? 1;

  if (pending.type === 'catPair') {
    next.log.push({
      type: 'cat',
      card: pending.card,
      actor: pending.actor,
      target: pending.target,
    });
    const targetPlayer = next.players.find(p => p.id === pending.target);
    stealRandomCard(actorPlayer, targetPlayer, rng);
    return;
  }

  switch (pending.card) {
    case CARD.skip: {
      next.log.push({ type: 'skip', actor: pending.actor });
      advanceTurnOrKeep(next, pending.actor);
      break;
    }
    case CARD.reverse: {
      next.direction = dir * -1;
      next.log.push({
        type: 'reverse',
        actor: pending.actor,
        direction: next.direction,
      });
      advanceTurnOrKeep(next, pending.actor);
      break;
    }
    case CARD.attack: {
      const nextPlayerId = getNextLivingPlayerId(next.players, pending.actor, dir);
      next.log.push({
        type: 'attack',
        actor: pending.actor,
        target: nextPlayerId,
      });
      next.currentPlayerId = nextPlayerId;
      next.turnsLeft = 2 + (next.turnsLeft - 1);
      break;
    }
    case CARD.shuffle: {
      next.deck = shuffle(next.deck, rng);
      next.log.push({ type: 'shuffle', actor: pending.actor });
      break;
    }
    case CARD.peek: {
      next.peek = {
        playerId: pending.actor,
        cards: next.deck.slice(0, 3),
      };
      next.log.push({ type: 'peek', actor: pending.actor });
      break;
    }
    case CARD.favor: {
      next.log.push({
        type: 'favor',
        actor: pending.actor,
        target: pending.target,
      });
      const targetPlayer = next.players.find(p => p.id === pending.target);
      stealRandomCard(actorPlayer, targetPlayer, rng);
      break;
    }
    default:
      break;
  }
}

/**
 * Kiểm tra xem có người chơi sống nào khác `lastActorId` đang giữ lá `nope` hay không.
 */
export function hasEligibleNopeHolder(state) {
  if (!state || state.phase !== 'nope' || !state.pendingAction) {
    return false;
  }
  const lastActorId = state.pendingAction.lastActorId;
  return state.players.some(
    p => p.alive && p.id !== lastActorId && p.hand.includes(CARD.nope)
  );
}

/**
 * Kiểm tra xem có người chơi sống nào khác `lastActorId` trong pha `nope` hay không.
 * Không kiểm tra bài trên tay (.hand) để tránh lộ thông tin lá `nope` của đối thủ.
 */
export function hasOtherLivingPlayer(state) {
  if (!state || state.phase !== 'nope' || !state.pendingAction || !Array.isArray(state.players)) {
    return false;
  }
  const lastActorId = state.pendingAction.lastActorId;
  return state.players.some(p => p.alive && p.id !== lastActorId);
}

/**
 * Giải quyết hành động đang chờ xác nhận trong pha `nope`.
 * @param {object} state
 * @param {() => number} rng
 */
export function resolvePendingAction(state, rng = Math.random) {
  if (!state || state.phase !== 'nope' || !state.pendingAction) {
    throw new GameError('Không có hành động nào đang chờ xác nhận', 'INVALID_ACTION');
  }
  const next = cloneState(state);
  resolvePendingInPlace(next, rng);
  next.version += 1;
  return next;
}

/**
 * Khởi tạo ván chơi mới theo Mục 4.1 và 4.2.
 * @param {Array<string|{id: string, name?: string}>} playerIds
 * @param {() => number} rng - Hàm trả về số ngẫu nhiên [0, 1)
 */
export function createGame(playerIds, rng = Math.random) {
  const players = normalizePlayers(playerIds);
  const n = players.length;

  // 1. Lấy phần bài thường (tỉ lệ theo số người chơi) và xáo kỹ
  const ordinaryPool = shuffle(buildOrdinaryDeck(n), rng);

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
    direction: 1,
    pendingDefuseId: null,
    pendingAction: null,
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
export function eliminatePlayer(state, playerId, reason = 'disconnect', rng = Math.random) {
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
    next.pendingAction = null;
    next.phase = 'over';
    next.winnerId = living.length === 1 ? living[0].id : null;
    next.log.push({
      type: 'game_over',
      winnerId: next.winnerId,
    });
    next.version += 1;
    return next;
  }

  // Xử lý pha nope nếu có pendingAction
  if (next.phase === 'nope' && next.pendingAction) {
    if (next.pendingAction.actor === playerId) {
      next.pendingAction = null;
      next.phase = 'play';
    } else {
      const eligibleIds = living
        .filter(p => p.id !== next.pendingAction.lastActorId)
        .map(p => p.id);
      if (
        eligibleIds.length === 0 ||
        eligibleIds.every(id => next.pendingAction.passedIds.includes(id))
      ) {
        resolvePendingInPlace(next, rng);
      }
    }
  }

  // Nếu người đó đang là người có lượt, chuyển lượt sang người sống kế tiếp theo chiều hiện tại
  if (next.currentPlayerId === playerId) {
    next.currentPlayerId = getNextLivingPlayerId(
      next.players,
      playerId,
      next.direction ?? 1
    );
    next.turnsLeft = 1;
  }

  next.version += 1;
  return next;
}

/**
 * Xử lý hành động trong pha `nope`.
 */
function handleNopePhaseAction(state, playerId, action, rng) {
  if (!state.pendingAction) {
    throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
  }

  const isNopePlay =
    action.type === 'nope' ||
    (action.type === 'play' && action.card === CARD.nope);

  if (isNopePlay) {
    if (playerId === state.pendingAction.lastActorId) {
      throw new GameError(
        'Không thể tự chặn hành động vừa đánh của mình',
        'INVALID_ACTION'
      );
    }

    const next = cloneState(state);
    const current = next.players.find(p => p.id === playerId);
    const nopeIdx = current.hand.indexOf(CARD.nope);
    if (nopeIdx === -1) {
      throw new GameError('Không có lá này trong tay', 'NO_CARD');
    }

    current.hand.splice(nopeIdx, 1);
    next.discardPile.push(CARD.nope);
    next.pendingAction.nopeCount += 1;
    next.pendingAction.lastActorId = playerId;
    next.pendingAction.passedIds = [];
    next.log.push({
      type: 'nope',
      actor: playerId,
      card: next.pendingAction.card,
      count: next.pendingAction.nopeCount,
    });
    next.version += 1;
    return next;
  }

  if (action.type === 'passNope') {
    if (playerId === state.pendingAction.lastActorId) {
      throw new GameError(
        'Không thể bỏ qua lượt chặn của chính mình',
        'INVALID_ACTION'
      );
    }

    const next = cloneState(state);
    if (!next.pendingAction.passedIds.includes(playerId)) {
      next.pendingAction.passedIds.push(playerId);
    }

    const eligibleIds = next.players
      .filter(p => p.alive && p.id !== next.pendingAction.lastActorId)
      .map(p => p.id);
    if (eligibleIds.every(id => next.pendingAction.passedIds.includes(id))) {
      resolvePendingInPlace(next, rng);
    }

    next.version += 1;
    return next;
  }

  if (action.type === 'resolveNope') {
    return resolvePendingAction(state, rng);
  }

  throw new GameError('Đang trong thời gian chặn bài (Nope)', 'INVALID_ACTION');
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

  if (state.phase === 'nope') {
    return handleNopePhaseAction(state, playerId, action, rng);
  }

  if (state.phase === 'defuse') {
    if (action.type !== 'defuse') {
      throw new GameError('Bạn đang phải gỡ bom', 'DEFUSE_PENDING');
    }
    if (playerId !== state.pendingDefuseId) {
      throw new GameError('Chưa đến lượt bạn', 'NOT_YOUR_TURN');
    }
  } else if (state.phase === 'play') {
    if (
      action.type === 'defuse' ||
      action.type === 'nope' ||
      action.type === 'passNope' ||
      action.type === 'resolveNope' ||
      (action.type === 'play' && action.card === CARD.nope)
    ) {
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

  // 1. Rút bài (draw) - không thể bị Nope
  if (action.type === 'draw') {
    if (next.deck.length === 0) {
      if (next.discardPile.length === 0) {
        next.phase = 'over';
        next.winnerId = null;
        next.log.push({ type: 'game_over', winnerId: null });
        next.version += 1;
        return next;
      }
      next.deck = shuffle(next.discardPile, rng);
      next.discardPile = [];
      next.log.push({ type: 'deck_reshuffled' });
    }

    const drawnCard = next.deck.shift();

    if (drawnCard === CARD.boom) {
      next.log.push({ type: 'bomb_drawn', actor: playerId });
      const defuseIdx = current.hand.indexOf(CARD.defuse);

      if (defuseIdx !== -1) {
        next.phase = 'defuse';
        next.pendingDefuseId = playerId;
        next.version += 1;
        return next;
      }

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

      next.currentPlayerId = getNextLivingPlayerId(
        next.players,
        playerId,
        next.direction ?? 1
      );
      next.turnsLeft = 1;
      next.version += 1;
      return next;
    }

    current.hand.push(drawnCard);
    next.log.push({ type: 'draw', actor: playerId });
    advanceTurnOrKeep(next, playerId);
    next.version += 1;
    return next;
  }

  // 2. Gỡ bom (defuse) - không thể bị Nope
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

    advanceTurnOrKeep(next, playerId);
    next.version += 1;
    return next;
  }

  // 3. Chơi cặp mèo cùng loại (catPair)
  if (action.type === 'catPair') {
    let catCard = null;
    if (action.card !== undefined && action.card !== null) {
      if (!CAT_CARDS.includes(action.card)) {
        throw new GameError('Loại lá mèo không hợp lệ', 'INVALID_ACTION');
      }
      catCard = action.card;
    } else {
      for (const breed of CAT_CARDS) {
        const count = current.hand.filter(c => c === breed).length;
        if (count >= 2) {
          catCard = breed;
          break;
        }
      }
      if (!catCard) {
        throw new GameError('Không có lá này trong tay', 'NO_CARD');
      }
    }

    const catIndices = [];
    current.hand.forEach((c, idx) => {
      if (c === catCard) catIndices.push(idx);
    });

    if (catIndices.length < 2) {
      throw new GameError('Không có lá này trong tay', 'NO_CARD');
    }

    validateTarget(next.players, playerId, action.target);

    current.hand.splice(catIndices[1], 1);
    current.hand.splice(catIndices[0], 1);
    next.discardPile.push(catCard, catCard);

    next.phase = 'nope';
    next.pendingAction = {
      type: 'catPair',
      card: catCard,
      actor: playerId,
      target: action.target,
      nopeCount: 0,
      lastActorId: playerId,
      passedIds: [],
    };
    next.version += 1;
    return next;
  }

  // 4. Đánh các lá đơn (skip, attack, reverse, shuffle, peek, favor)
  const card = action.type === 'play' ? action.card : action.type;

  if (card === CARD.boom || card === CARD.defuse || CAT_CARDS.includes(card)) {
    throw new GameError('Lá này không thể đánh riêng', 'INVALID_CARD');
  }

  if (!NOPEABLE_SINGLE_CARDS.includes(card)) {
    throw new GameError('Hành động không hợp lệ', 'INVALID_ACTION');
  }

  const cardIdx = current.hand.indexOf(card);
  if (cardIdx === -1) {
    throw new GameError('Không có lá này trong tay', 'NO_CARD');
  }

  if (card === CARD.favor) {
    validateTarget(next.players, playerId, action.target);
  }

  current.hand.splice(cardIdx, 1);
  next.discardPile.push(card);

  next.phase = 'nope';
  next.pendingAction = {
    type: 'play',
    card,
    actor: playerId,
    target: card === CARD.favor ? action.target : null,
    nopeCount: 0,
    lastActorId: playerId,
    passedIds: [],
  };
  next.version += 1;
  return next;
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

  const pendingActionView = state.pendingAction
    ? {
        type: state.pendingAction.type,
        card: state.pendingAction.card,
        actor: state.pendingAction.actor,
        target: state.pendingAction.target ?? null,
        nopeCount: state.pendingAction.nopeCount,
        lastActorId: state.pendingAction.lastActorId,
        passedIds: [...(state.pendingAction.passedIds ?? [])],
      }
    : null;

  return {
    version: state.version,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    turnsLeft: state.turnsLeft,
    direction: state.direction ?? 1,
    pendingDefuseId: state.pendingDefuseId,
    pendingAction: pendingActionView,
    winnerId: state.winnerId,
    deckCount: state.deck.length,
    discardCount: state.discardPile.length,
    discardTop,
    players: playersView,
    peek: peekView,
    log: state.log.map(entry => ({ ...entry })),
  };
}
