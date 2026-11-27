import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './styles/base.css';

import {
  StoreProvider,
  useStore,
  ACTION_TYPES,
} from './state/store.js';

import {
  getSocket,
  emitWithAck,
  getOrCreatePlayerId,
  getStoredRoomCode,
  setStoredRoomCode,
  clearStoredRoomCode,
} from './net/socket.js';

import { getStrings } from './i18n/index.js';

import { Home } from './screens/Home.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { Game } from './screens/Game.jsx';
import GameOver from './screens/GameOver.jsx';

import Card from './components/Card.jsx';
import Hand from './components/Hand.jsx';
import ActionBar from './components/ActionBar.jsx';
import TargetPicker from './components/TargetPicker.jsx';
import DefuseDialog from './components/DefuseDialog.jsx';
import PeekPanel from './components/PeekPanel.jsx';
import Toast from './components/Toast.jsx';
import Chat from './components/Chat.jsx';
import HelpModal from './components/HelpModal.jsx';

// Rule descriptions for cards (rules.md section 4.1 & card.md)
const CARD_RULES_VI = {
  boom: 'Rút phải là bị loại, trừ khi có Kìm Cắt Dây',
  defuse: 'Cứu mạng khi rút phải Mèo Bùm',
  attack: 'Kết thúc lượt không rút, người kế tiếp chơi 2 lượt',
  skip: 'Kết thúc lượt không rút',
  shuffle: 'Xáo bộ rút, lượt tiếp tục',
  favor: 'Lấy ngẫu nhiên 1 lá của người khác',
  peek: 'Xem 3 lá trên cùng, chỉ mình thấy',
  cat: 'Chơi cặp 2 lá, lấy ngẫu nhiên 1 lá của một người',
};

const CARD_RULES_EN = {
  boom: 'Eliminated if drawn, unless you have Defuse',
  defuse: 'Saves you from the exploding bomb',
  attack: 'End turn without drawing; next player takes 2 turns',
  skip: 'End turn without drawing',
  shuffle: 'Shuffle the draw pile, turn continues',
  favor: 'Take 1 random card from another player',
  peek: 'Privately view the top 3 cards',
  cat: 'Play a pair to steal 1 random card from a player',
};

function AppContent() {
  const [state, dispatch] = useStore();
  const { screen, roomState, gameState, locale, toast } = state;
  const strings = useMemo(() => getStrings(locale), [locale]);

  // Player identity & connection tracking
  const [myPlayerId, setMyPlayerId] = useState(() => getOrCreatePlayerId());
  const [name, setName] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('meo-no:playerName') || '';
      }
    } catch {}
    return '';
  });
  const [joinCode, setJoinCode] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  const [socketConnected, setSocketConnected] = useState(() => {
    try {
      return getSocket().connected;
    } catch {
      return false;
    }
  });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);

  // Local UI-only interaction state
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [targetPickerAction, setTargetPickerAction] = useState(null); // 'favor' | 'catPair'
  const [insertAt, setInsertAt] = useState(0);

  // Keep playerId up to date
  useEffect(() => {
    const id = getOrCreatePlayerId();
    if (id && id !== myPlayerId) {
      setMyPlayerId(id);
    }
  }, [myPlayerId]);

  // Persist player name locally for convenience
  const handleNameChange = useCallback((val) => {
    setName(val);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('meo-no:playerName', val);
      }
    } catch {}
  }, []);

  // 1. On mount: check stored room code and attempt room:resume
  useEffect(() => {
    const id = getOrCreatePlayerId();
    const storedCode = getStoredRoomCode();

    if (storedCode && id) {
      setIsResuming(true);
      emitWithAck('room:resume', { playerId: id, code: storedCode })
        .then((ack) => {
          if (ack?.ok) {
            if (ack.room) {
              dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: ack.room });
            }
            if (ack.game) {
              dispatch({ type: ACTION_TYPES.GAME_STATE_RECEIVED, payload: ack.game });
            }
          } else {
            clearStoredRoomCode();
            dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
            if (ack?.code) {
              const msg = strings.errors?.[ack.code] || ack.message || ack.code;
              dispatch({
                type: ACTION_TYPES.ERROR_RECEIVED,
                payload: { code: ack.code, message: msg },
              });
            }
          }
        })
        .catch(() => {
          clearStoredRoomCode();
          dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
        })
        .finally(() => {
          setIsResuming(false);
        });
    } else {
      dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
    }
  }, [dispatch, strings]);

  // 2. Subscribe to server -> client socket events
  useEffect(() => {
    const socket = getSocket();

    const handleRoomState = (payload) => {
      dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload });
    };

    const handleGameState = (payload) => {
      dispatch({ type: ACTION_TYPES.GAME_STATE_RECEIVED, payload });
    };

    const handleGameError = (error) => {
      const message =
        error?.message ||
        (error?.code ? strings.errors?.[error.code] : null) ||
        'Có lỗi xảy ra';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: error?.code, message },
      });
    };

    const handleSessionReplaced = () => {
      clearStoredRoomCode();
      dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: {
          code: 'SESSION_REPLACED',
          message: 'Phiên kết nối đã được mở ở một tab hoặc thiết bị khác',
        },
      });
    };

    const handleConnect = () => {
      setSocketConnected(true);
      setIsReconnecting(false);
      const code = getStoredRoomCode();
      const id = getOrCreatePlayerId();
      if (code && id) {
        emitWithAck('room:resume', { playerId: id, code })
          .then((ack) => {
            if (ack?.ok) {
              if (ack.room) {
                dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: ack.room });
              }
              if (ack.game) {
                dispatch({ type: ACTION_TYPES.GAME_STATE_RECEIVED, payload: ack.game });
              }
            } else {
              clearStoredRoomCode();
              dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
            }
          })
          .catch(() => {});
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setIsReconnecting(true);
    };

    const handleChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    socket.on('room:state', handleRoomState);
    socket.on('game:state', handleGameState);
    socket.on('game:error', handleGameError);
    socket.on('session:replaced', handleSessionReplaced);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat:message', handleChatMessage);

    if (socket.connected) {
      setSocketConnected(true);
      setIsReconnecting(false);
    }

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('game:state', handleGameState);
      socket.off('game:error', handleGameError);
      socket.off('session:replaced', handleSessionReplaced);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat:message', handleChatMessage);
    };
  }, [dispatch, strings]);

  const handleSendChat = useCallback((text) => {
    emitWithAck('chat:message', { text }).catch(() => {});
  }, []);

  // Derived toast message & dismiss callback
  const toastText = useMemo(() => {
    if (!toast) return null;
    if (typeof toast === 'string') return toast;
    if (typeof toast === 'object') {
      if (toast.message) return toast.message;
      if (toast.code && strings.errors?.[toast.code]) {
        return strings.errors[toast.code];
      }
      if (toast.code) return toast.code;
    }
    return String(toast);
  }, [toast, strings]);

  const handleDismissToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.TOAST_CLEARED });
  }, [dispatch]);

  // Card renderer matching Card.jsx props
  const renderCard = useCallback(
    (cardProps) => {
      if (!cardProps) return null;
      const { id, type, key, ...restProps } = cardProps;
      const cardType = type || 'cat';
      const label = cardProps.label || strings.cards?.[cardType] || cardType;
      const ruleText =
        cardProps.ruleText ||
        (locale === 'en' ? CARD_RULES_EN[cardType] : CARD_RULES_VI[cardType]) ||
        '';

      return (
        <Card
          key={id || key || `${cardType}-${label}`}
          type={cardType}
          label={label}
          ruleText={ruleText}
          {...restProps}
        />
      );
    },
    [strings, locale]
  );

  // ==========================================================================
  // HOME SCREEN HANDLERS
  // ==========================================================================
  const handleCreateRoom = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const playerId = getOrCreatePlayerId();
    const ack = await emitWithAck('room:create', { playerId, name: trimmed });
    if (ack?.ok && ack.code) {
      setStoredRoomCode(ack.code);
    } else if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Không thể tạo phòng';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [name, strings, dispatch]);

  const handleJoinRoom = useCallback(async () => {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || code.length !== 5) return;
    const playerId = getOrCreatePlayerId();
    const ack = await emitWithAck('room:join', {
      playerId,
      name: trimmed,
      code,
    });
    if (ack?.ok && ack.code) {
      setStoredRoomCode(ack.code);
    } else if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Không thể vào phòng';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [name, joinCode, strings, dispatch]);

  // ==========================================================================
  // LOBBY SCREEN HANDLERS & STATE
  // ==========================================================================
  const isHost = useMemo(() => {
    if (!roomState?.hostId || !myPlayerId) return false;
    return roomState.hostId === myPlayerId;
  }, [roomState?.hostId, myPlayerId]);

  const lobbyPlayers = useMemo(() => {
    return (roomState?.players || []).map((p) => ({
      ...p,
      isHost: p.id === roomState?.hostId,
    }));
  }, [roomState?.players, roomState?.hostId]);

  const connectedPlayersCount = useMemo(() => {
    return (roomState?.players || []).filter((p) => p.connected !== false).length;
  }, [roomState?.players]);

  const canStartLobbyGame = isHost && connectedPlayersCount >= 2;
  const startDisabledReason =
    connectedPlayersCount < 2
      ? strings.lobby?.needTwoPlayers || 'Cần ít nhất 2 người đang kết nối để bắt đầu'
      : undefined;

  const handleStartGame = useCallback(async () => {
    const ack = await emitWithAck('game:start', {});
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Không thể bắt đầu ván';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [strings, dispatch]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      await emitWithAck('room:leave', {});
    } catch {}
    clearStoredRoomCode();
    setChatMessages([]);
    dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
  }, [dispatch]);

  const handleCopyCode = useCallback(async () => {
    if (!roomState?.code) return;
    try {
      await navigator.clipboard.writeText(roomState.code);
    } catch {}
  }, [roomState?.code]);

  const handleShareCode = useCallback(async () => {
    if (!roomState?.code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Mèo Nổ',
          text: `Mã phòng Mèo Nổ: ${roomState.code}`,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(roomState.code);
      }
    } catch {}
  }, [roomState?.code]);

  // ==========================================================================
  // GAME SCREEN COMPOSITION & STATE
  // ==========================================================================
  // Merge room player status (seat, connected) into game players
  const mergedGamePlayers = useMemo(() => {
    const roomPlayers = roomState?.players || [];
    const gamePlayers = gameState?.players || [];

    if (gamePlayers.length === 0) {
      return roomPlayers;
    }

    return gamePlayers.map((gp) => {
      const rp = roomPlayers.find((p) => p.id === gp.id);
      return {
        ...gp,
        connected: rp ? rp.connected : gp.connected,
        seat: rp ? rp.seat : undefined,
      };
    });
  }, [roomState?.players, gameState?.players]);

  const myPlayer = useMemo(() => {
    return mergedGamePlayers.find((p) => p.id === myPlayerId) || null;
  }, [mergedGamePlayers, myPlayerId]);

  // Notify the player clearly when someone else's action targets THEM --
  // per rules.md section E2, `attack`/`favor`/`cat` log entries carry a
  // `target` field; previously this only showed up in the (now collapsible,
  // easy-to-miss) log panel. Watches for new log entries since the last
  // render (keyed by log length, since the log is append-only) rather than
  // reacting to every gameState update, so it only fires once per event.
  const lastSeenLogLengthRef = useRef(0);
  useEffect(() => {
    const log = gameState?.log;
    if (!Array.isArray(log)) return;

    if (log.length < lastSeenLogLengthRef.current) {
      // A new/different game (rematch, or a fresh game:state after reconnect
      // with a shorter log) -- resync without replaying old notifications.
      lastSeenLogLengthRef.current = log.length;
      return;
    }

    const newEntries = log.slice(lastSeenLogLengthRef.current);
    lastSeenLogLengthRef.current = log.length;
    if (newEntries.length === 0 || !myPlayerId) return;

    for (const entry of newEntries) {
      if (!entry || entry.target !== myPlayerId || entry.actor === myPlayerId) continue;
      const actorPlayer = mergedGamePlayers.find((p) => p.id === entry.actor);
      const actorName = actorPlayer?.name || entry.actor;

      let message = null;
      if (entry.type === 'attack') {
        message = `${actorName} vừa đánh Truy Đuổi — bạn sẽ phải chơi thêm lượt!`;
      } else if (entry.type === 'favor') {
        message = `${actorName} vừa Nài Nỉ — họ đã lấy ngẫu nhiên 1 lá từ tay bạn.`;
      } else if (entry.type === 'cat') {
        message = `${actorName} vừa chơi cặp Mèo Vằn nhắm vào bạn — họ đã lấy ngẫu nhiên 1 lá từ tay bạn.`;
      }
      if (message) {
        dispatch({ type: ACTION_TYPES.ERROR_RECEIVED, payload: { code: null, message } });
        break; // one toast at a time; if several targeted us in one update, the log panel has the rest
      }
    }
  }, [gameState?.log, myPlayerId, mergedGamePlayers, dispatch]);

  const isMyTurn =
    gameState?.phase === 'play' &&
    gameState?.currentPlayerId === myPlayerId &&
    myPlayer?.alive !== false;

  const isDefusing =
    gameState?.phase === 'defuse' &&
    gameState?.pendingDefuseId === myPlayerId;

  const otherDefusingId =
    gameState?.phase === 'defuse' &&
    gameState?.pendingDefuseId &&
    gameState?.pendingDefuseId !== myPlayerId
      ? gameState.pendingDefuseId
      : null;

  const otherDefusingName = useMemo(() => {
    if (!otherDefusingId) return null;
    const player = mergedGamePlayers.find((p) => p.id === otherDefusingId);
    return player?.name || otherDefusingId;
  }, [otherDefusingId, mergedGamePlayers]);

  // Build hand cards array with stable unique IDs
  const myHandCards = useMemo(() => {
    if (!myPlayer || !Array.isArray(myPlayer.hand)) return [];
    return myPlayer.hand.map((cardItem, index) => {
      if (typeof cardItem === 'string') {
        return {
          id: `hand-card-${index}-${cardItem}`,
          type: cardItem,
          index,
        };
      }
      return {
        id: cardItem.id || `hand-card-${index}-${cardItem.type}`,
        type: cardItem.type,
        index,
      };
    });
  }, [myPlayer]);

  // Playable card IDs in hand: rules.md section 4.3, 4.5
  const catCardsInHand = useMemo(() => {
    return myHandCards.filter((c) => c.type === 'cat');
  }, [myHandCards]);

  const hasCatPair = catCardsInHand.length >= 2;

  const candidates = useMemo(() => {
    return mergedGamePlayers
      .filter((p) => p.id !== myPlayerId && p.alive !== false)
      .map((p) => ({ id: p.id, name: p.name || p.id }));
  }, [mergedGamePlayers, myPlayerId]);

  const playableCardIds = useMemo(() => {
    if (!isMyTurn || !socketConnected) {
      return new Set();
    }
    const playableTypes = new Set(['skip', 'attack', 'shuffle', 'peek']);
    if (candidates.length > 0) {
      playableTypes.add('favor');
      if (hasCatPair) {
        playableTypes.add('cat');
      }
    }
    return new Set(
      myHandCards
        .filter((c) => playableTypes.has(c.type))
        .map((c) => c.id)
    );
  }, [isMyTurn, socketConnected, candidates.length, hasCatPair, myHandCards]);

  // Explains WHY a specific disabled card can't be played, mirroring the
  // exact logic playableCardIds uses above -- passed to Hand's optional
  // getDisabledReason prop so a tap on a dimmed card shows a real reason
  // instead of just doing nothing.
  const getDisabledReason = useCallback(
    (card) => {
      if (!socketConnected) return 'Đang mất kết nối, vui lòng chờ';
      if (!isMyTurn) return 'Chưa đến lượt bạn';
      if (card?.type === 'defuse') return 'Không thể đánh lá Gỡ Bom riêng — chỉ dùng khi rút phải Mèo Bùm';
      if (card?.type === 'boom') return 'Không thể đánh lá Mèo Bùm riêng';
      if (card?.type === 'cat' && !hasCatPair) return 'Cần có ít nhất 2 lá Mèo Vằn để chơi cặp';
      if ((card?.type === 'cat' || card?.type === 'favor') && candidates.length === 0) {
        return 'Không còn người chơi nào để nhắm mục tiêu';
      }
      return 'Lá này không thể đánh lúc này';
    },
    [socketConnected, isMyTurn, hasCatPair, candidates.length]
  );

  const handleToggleSelectCard = useCallback(
    (cardId) => {
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else {
          const clickedCard = myHandCards.find((c) => c.id === cardId);
          if (clickedCard?.type === 'cat') {
            for (const selId of next) {
              const selCard = myHandCards.find((c) => c.id === selId);
              if (selCard?.type !== 'cat') {
                next.delete(selId);
              }
            }
            if (next.size < 2) {
              next.add(cardId);
            }
          } else {
            next.clear();
            next.add(cardId);
          }
        }
        return next;
      });
    },
    [myHandCards]
  );

  // ActionBar action handlers
  const canDraw = isMyTurn && socketConnected;
  const canSkip = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'skip');
  const canAttack = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'attack');
  const canFavor =
    isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'favor') && candidates.length > 0;
  const canCatPair = isMyTurn && socketConnected && hasCatPair && candidates.length > 0;
  const canPeek = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'peek');
  const canShuffle = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'shuffle');

  const handleDrawAction = useCallback(async () => {
    if (!canDraw) return;
    const ack = await emitWithAck('game:action', { type: 'draw' });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [canDraw, strings, dispatch]);

  const handleSkipAction = useCallback(async () => {
    if (!canSkip) return;
    const ack = await emitWithAck('game:action', { type: 'play', card: 'skip' });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [canSkip, strings, dispatch]);

  const handleAttackAction = useCallback(async () => {
    if (!canAttack) return;
    const ack = await emitWithAck('game:action', { type: 'play', card: 'attack' });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [canAttack, strings, dispatch]);

  const handleShuffleAction = useCallback(async () => {
    if (!canShuffle) return;
    const ack = await emitWithAck('game:action', { type: 'play', card: 'shuffle' });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [canShuffle, strings, dispatch]);

  const handlePeekAction = useCallback(async () => {
    if (!canPeek) return;
    const ack = await emitWithAck('game:action', { type: 'play', card: 'peek' });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [canPeek, strings, dispatch]);

  const handleFavorAction = useCallback(() => {
    if (!canFavor) return;
    setTargetPickerAction('favor');
    setTargetPickerOpen(true);
  }, [canFavor]);

  const handleCatPairAction = useCallback(() => {
    if (!canCatPair) return;
    const selectedCats = catCardsInHand.filter((c) => selectedCardIds.has(c.id));
    if (selectedCats.length !== 2) {
      setSelectedCardIds(new Set([catCardsInHand[0].id, catCardsInHand[1].id]));
    }
    setTargetPickerAction('catPair');
    setTargetPickerOpen(true);
  }, [canCatPair, catCardsInHand, selectedCardIds]);

  const handlePickTarget = useCallback(
    async (targetPlayerId) => {
      setTargetPickerOpen(false);
      const actionType = targetPickerAction;
      setTargetPickerAction(null);

      if (actionType === 'favor') {
        const ack = await emitWithAck('game:action', {
          type: 'play',
          card: 'favor',
          target: targetPlayerId,
        });
        if (!ack?.ok) {
          const msg =
            ack?.message ||
            (ack?.code ? strings.errors?.[ack.code] : null) ||
            'Hành động không hợp lệ';
          dispatch({
            type: ACTION_TYPES.ERROR_RECEIVED,
            payload: { code: ack?.code, message: msg },
          });
        }
      } else if (actionType === 'catPair') {
        const ack = await emitWithAck('game:action', {
          type: 'catPair',
          target: targetPlayerId,
        });
        setSelectedCardIds(new Set());
        if (!ack?.ok) {
          const msg =
            ack?.message ||
            (ack?.code ? strings.errors?.[ack.code] : null) ||
            'Hành động không hợp lệ';
          dispatch({
            type: ACTION_TYPES.ERROR_RECEIVED,
            payload: { code: ack?.code, message: msg },
          });
        }
      }
    },
    [targetPickerAction, strings, dispatch]
  );

  const handleCancelTarget = useCallback(() => {
    setTargetPickerOpen(false);
    setTargetPickerAction(null);
  }, []);

  const handleConfirmDefuse = useCallback(async () => {
    const deckCount = gameState?.deckCount ?? 0;
    const safeInsert = Math.min(Math.max(0, Number(insertAt) || 0), deckCount);
    const ack = await emitWithAck('game:action', {
      type: 'defuse',
      insertAt: safeInsert,
    });
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Hành động không hợp lệ';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [gameState?.deckCount, insertAt, strings, dispatch]);

  // Log line renderer using i18n log templates
  const renderLogLine = useCallback(
    (entry) => {
      if (!entry) return '';
      if (typeof entry === 'string') return entry;

      const actorName = entry.actor
        ? mergedGamePlayers.find((p) => p.id === entry.actor)?.name || entry.actor
        : '';
      const targetName = entry.target
        ? mergedGamePlayers.find((p) => p.id === entry.target)?.name || entry.target
        : '';

      const logTemplates = strings.log || {};

      switch (entry.type) {
        case 'draw':
          return logTemplates.draw ? logTemplates.draw(actorName) : `${actorName} rút một lá`;
        case 'bomb_drawn':
          return logTemplates.bomb_drawn
            ? logTemplates.bomb_drawn(actorName)
            : `${actorName} rút phải bom!`;
        case 'defused':
          return logTemplates.defused
            ? logTemplates.defused(actorName)
            : `${actorName} đã gỡ bom thành công`;
        case 'eliminated':
          return logTemplates.eliminated
            ? logTemplates.eliminated(actorName, entry.reason)
            : `${actorName} đã bị loại`;
        case 'skip':
          return logTemplates.skip ? logTemplates.skip(actorName) : `${actorName} đánh Bỏ qua`;
        case 'attack':
          return logTemplates.attack
            ? logTemplates.attack(actorName, targetName)
            : `${actorName} đánh Tấn công`;
        case 'shuffle':
          return logTemplates.shuffle ? logTemplates.shuffle(actorName) : `${actorName} đánh Xáo bài`;
        case 'peek':
          return logTemplates.peek ? logTemplates.peek(actorName) : `${actorName} đánh Nhìn trước`;
        case 'favor':
          return logTemplates.favor
            ? logTemplates.favor(actorName, targetName)
            : `${actorName} đánh Nhờ vả`;
        case 'cat':
          return logTemplates.cat
            ? logTemplates.cat(actorName, targetName)
            : `${actorName} chơi cặp mèo`;
        case 'deck_reshuffled':
          return logTemplates.deck_reshuffled
            ? logTemplates.deck_reshuffled()
            : 'Đã xáo lại bài đã đánh thành bộ rút';
        case 'game_over': {
          const winnerId = entry.winner || entry.winnerId;
          const winnerPlayer = winnerId ? mergedGamePlayers.find((p) => p.id === winnerId) : null;
          const winnerDispName = winnerPlayer?.name || winnerId || null;
          return logTemplates.game_over
            ? logTemplates.game_over(winnerDispName)
            : winnerDispName
            ? `${winnerDispName} đã chiến thắng!`
            : 'Ván chơi kết thúc, không ai thắng';
        }
        default:
          if (typeof logTemplates[entry.type] === 'function') {
            return logTemplates[entry.type](actorName, targetName);
          }
          return `${actorName} ${entry.type} ${targetName}`.trim();
      }
    },
    [strings, mergedGamePlayers]
  );

  // ==========================================================================
  // GAMEOVER SCREEN HANDLERS & STATE
  // ==========================================================================
  const winnerName = useMemo(() => {
    if (!gameState?.winnerId) return null;
    const winnerPlayer = mergedGamePlayers.find((p) => p.id === gameState.winnerId);
    return winnerPlayer?.name || String(gameState.winnerId);
  }, [gameState?.winnerId, mergedGamePlayers]);

  const handleRematch = useCallback(async () => {
    const ack = await emitWithAck('room:rematch', {});
    if (!ack?.ok) {
      const msg =
        ack?.message ||
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        'Không thể chơi lại';
      dispatch({
        type: ACTION_TYPES.ERROR_RECEIVED,
        payload: { code: ack?.code, message: msg },
      });
    }
  }, [strings, dispatch]);

  // ==========================================================================
  // SCREEN TRANSLATION SHAPES
  // ==========================================================================
  const homeT = useMemo(
    () => ({
      title: 'Mèo Nổ',
      subtitle: 'Game thẻ bài sinh tồn',
      ...strings.home,
      createRoomButton: strings.home?.createRoom || 'Tạo phòng',
      orDivider: 'hoặc',
      joinCodeLabel: strings.home?.roomCodeLabel || 'Mã phòng',
      joinCodePlaceholder: strings.home?.roomCodePlaceholder || 'Mã 5 ký tự',
      joinRoomButton: strings.home?.joinRoom || 'Vào phòng',
      resumingMessage: strings.home?.rejoining || 'Đang vào lại phòng…',
    }),
    [strings]
  );

  const lobbyT = useMemo(
    () => ({
      ...strings.lobby,
      title: strings.lobby?.title || 'Phòng chờ',
      roomCodeLabel: strings.lobby?.roomCode || 'Mã phòng',
      copyCodeButton: strings.lobby?.copy || 'Sao chép',
      copyCodeAriaLabel: 'Sao chép mã phòng',
      shareCodeButton: strings.lobby?.share || 'Chia sẻ',
      shareCodeAriaLabel: 'Chia sẻ mã phòng',
      playerListTitle: strings.lobby?.players || 'Người chơi',
      seatLabel: 'Ghế',
      hostBadge: strings.lobby?.host || 'Chủ phòng',
      offlineBadge: strings.lobby?.offline || 'Đang offline',
      onlineBadge: 'Sẵn sàng',
      startButton: strings.lobby?.start || 'Bắt đầu',
      waitingForHostMessage: strings.lobby?.waitingForHost || 'Đang chờ chủ phòng bắt đầu',
      leaveRoomButton: strings.lobby?.leave || 'Rời phòng',
    }),
    [strings]
  );

  const gameOverT = useMemo(
    () => ({
      ...strings.gameOver,
      gameOverTitle: strings.gameOver?.title || 'Kết thúc ván',
      winnerMessage: 'Người chiến thắng',
      noWinnerMessage: strings.gameOver?.noWinner || 'Không ai thắng',
      rematchButton: strings.gameOver?.playAgain || 'Chơi lại',
      leaveButton: strings.gameOver?.leaveRoom || 'Rời phòng',
      waitingForRematchMessage: strings.gameOver?.waitingForHost || 'Đang chờ chủ phòng chơi lại',
    }),
    [strings]
  );

  const gameT = useMemo(
    () => ({
      ...strings.game,
      drawPile: strings.game?.deck || 'Bộ rút',
      discardPile: strings.game?.discard || 'Bài đã đánh',
      cardNames: strings.cards,
    }),
    [strings]
  );

  const handT = useMemo(
    () => ({
      ...strings.cards,
      hand: strings.game?.yourHand || 'Bài trên tay',
      handAriaLabel: 'Khu vực bài trên tay',
      emptyHand: 'Không có lá bài nào trên tay',
      selected: 'Đã chọn',
      unselected: 'Chưa chọn',
      cardDisabled: 'Không thể đánh',
    }),
    [strings]
  );

  const actionBarT = useMemo(
    () => ({
      ...strings.actions,
      actionBarAriaLabel: 'Thanh hành động',
      turnsLeftLabel: strings.game?.turnsLeft || ((n) => `Còn ${n} lượt`),
    }),
    [strings]
  );

  const targetPickerT = useMemo(
    () => ({
      ...strings.dialog?.targetPicker,
      targetPickerTitle: strings.dialog?.targetPicker?.title || 'Chọn mục tiêu',
      targetPickerPrompt: 'Chọn một người chơi còn sống để thực hiện:',
      targetPickerAriaLabel: 'Hộp thoại chọn mục tiêu',
      cancel: strings.dialog?.targetPicker?.cancel || 'Hủy',
      noCandidates: 'Không có người chơi nào để chọn',
    }),
    [strings]
  );

  const defuseT = useMemo(
    () => ({
      ...strings.dialog?.defuse,
      defuseTitle: strings.dialog?.defuse?.title || 'Gỡ bom',
      defusePrompt: 'Chọn vị trí đặt lại Mèo Bùm vào bộ rút bài:',
      defuseAriaLabel: 'Hộp thoại gỡ bom',
      topOfDeck: strings.dialog?.defuse?.top || 'Trên cùng',
      bottomOfDeck: strings.dialog?.defuse?.deepest || 'Sâu nhất',
      placeBomb: strings.dialog?.defuse?.placeBomb || 'Đặt bom',
    }),
    [strings]
  );

  const peekPanelT = useMemo(
    () => ({
      ...strings.cards,
      peekTitle: strings.peekPanel?.title || 'Nhìn trước (3 lá trên cùng)',
      peekSubtitle: 'Thứ tự từ trên xuống dưới của bộ rút:',
      peekAriaLabel: strings.peekPanel?.title || 'Nhìn trước (3 lá trên cùng)',
    }),
    [strings]
  );

  const chatT = useMemo(
    () => ({
      chatTitle: 'Trò chuyện',
      chatPlaceholder: 'Nhập tin nhắn...',
      chatSendButton: 'Gửi',
      chatEmpty: 'Chưa có tin nhắn nào',
      chatYou: 'Bạn',
      chatInputAriaLabel: 'Nội dung tin nhắn',
      chatRegionAriaLabel: 'Hộp trò chuyện',
      chatListAriaLabel: 'Danh sách tin nhắn',
    }),
    []
  );

  // ==========================================================================
  // RENDER CURRENT SCREEN
  // ==========================================================================
  const renderCurrentScreen = () => {
    switch (screen) {
      case 'lobby':
        return (
          <Lobby
            t={lobbyT}
            roomCode={roomState?.code}
            players={lobbyPlayers}
            isHost={isHost}
            canStart={canStartLobbyGame}
            startDisabledReason={startDisabledReason}
            onStart={handleStartGame}
            onCopyCode={handleCopyCode}
            onShareCode={handleShareCode}
            onLeave={handleLeaveRoom}
          />
        );

      case 'game':
        return (
          <Game
            gameState={gameState}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState?.currentPlayerId}
            turnsLeft={gameState?.turnsLeft}
            deckCount={gameState?.deckCount ?? 0}
            discardCount={gameState?.discardCount ?? 0}
            discardTop={gameState?.discardTop ?? null}
            players={mergedGamePlayers}
            log={gameState?.log || []}
            toastMessage={toastText}
            onDismissToast={handleDismissToast}
            renderCard={renderCard}
            renderLogLine={renderLogLine}
            t={gameT}
            actionBarSlot={
              <ActionBar
                t={actionBarT}
                canDraw={canDraw}
                onDraw={handleDrawAction}
                canSkip={canSkip}
                onSkip={handleSkipAction}
                canAttack={canAttack}
                onAttack={handleAttackAction}
                canFavor={canFavor}
                onFavor={handleFavorAction}
                canCatPair={canCatPair}
                onCatPair={handleCatPairAction}
                canPeek={canPeek}
                onPeek={handlePeekAction}
                canShuffle={canShuffle}
                onShuffle={handleShuffleAction}
                turnsLeft={gameState?.turnsLeft}
                formatTurnsLeft={strings.game?.turnsLeft}
                turnDeadline={isMyTurn ? gameState?.turnDeadline : null}
              />
            }
            handSlot={
              myPlayer?.alive !== false ? (
                <Hand
                  cards={myHandCards}
                  selectedIds={selectedCardIds}
                  onToggleSelect={handleToggleSelectCard}
                  playableIds={playableCardIds}
                  getDisabledReason={getDisabledReason}
                  renderCard={renderCard}
                  t={handT}
                />
              ) : null
            }
          >
            {/* Leave room trigger (mid-game) -- there was previously no way to
                leave once a match started; leaving here eliminates the player
                in the engine (see server room:leave handler) so the match
                stays consistent for everyone else. */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Rời trận đấu? Bạn sẽ bị loại khỏi ván này.')) {
                  handleLeaveRoom();
                }
              }}
              aria-label="Rời trận đấu"
              title="Rời trận đấu"
              style={{
                position: 'fixed',
                top: '12px',
                right: '64px',
                zIndex: 40,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '2px solid #2B2326',
                backgroundColor: '#F6EFE2',
                color: '#2B2326',
                fontSize: '1.2rem',
                cursor: 'pointer',
              }}
            >
              🚪
            </button>

            {/* Help / how-to-play trigger */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Xem hướng dẫn chơi"
              style={{
                position: 'fixed',
                top: '12px',
                right: '12px',
                zIndex: 40,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '2px solid #2B2326',
                backgroundColor: '#F6EFE2',
                color: '#2B2326',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              ?
            </button>
            <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

            {/* Status banners */}
            {isReconnecting && (
              <div
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#e74c3c',
                  color: '#ffffff',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  marginBottom: '8px',
                }}
                role="alert"
              >
                {strings.banners?.reconnecting || 'Đang kết nối lại…'}
              </div>
            )}
            {myPlayer?.alive === false && (
              <div
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#7f8c8d',
                  color: '#ffffff',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  marginBottom: '8px',
                }}
                role="status"
              >
                {strings.banners?.eliminated || 'Bạn đã bị loại. Bạn đang xem'}
              </div>
            )}
            {otherDefusingName && (
              <div
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#f39c12',
                  color: '#ffffff',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  marginBottom: '8px',
                }}
                role="status"
              >
                {strings.dialog?.defuse?.defusing
                  ? strings.dialog.defuse.defusing(otherDefusingName)
                  : `${otherDefusingName} đang gỡ bom…`}
              </div>
            )}

            {/* PeekPanel preview modal */}
            {gameState?.peek && Array.isArray(gameState.peek) && (
              <PeekPanel
                peek={gameState.peek}
                t={peekPanelT}
                renderCard={renderCard}
              />
            )}

            {/* TargetPicker dialog */}
            <TargetPicker
              open={targetPickerOpen}
              candidates={candidates}
              onPick={handlePickTarget}
              onCancel={handleCancelTarget}
              t={targetPickerT}
            />

            {/* DefuseDialog dialog */}
            <DefuseDialog
              open={isDefusing}
              deckCount={gameState?.deckCount || 0}
              insertAt={insertAt}
              onInsertAtChange={setInsertAt}
              onConfirm={handleConfirmDefuse}
              t={defuseT}
            />

            {/* Real-time chat */}
            <Chat
              messages={chatMessages}
              myPlayerId={myPlayerId}
              onSend={handleSendChat}
              t={chatT}
            />
          </Game>
        );

      case 'gameOver':
        return (
          <GameOver
            t={gameOverT}
            winnerName={winnerName}
            isHost={isHost}
            onRematch={handleRematch}
            onLeave={handleLeaveRoom}
          />
        );

      case 'home':
      default:
        return (
          <Home
            t={homeT}
            name={name}
            onNameChange={handleNameChange}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            isResuming={isResuming}
          />
        );
    }
  };

  return (
    <>
      {screen !== 'game' && toastText && (
        <Toast message={toastText} onDismiss={handleDismissToast} />
      )}
      {renderCurrentScreen()}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
