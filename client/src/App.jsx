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
import ThemePicker from './components/ThemePicker.jsx';
import CardFlightLayer from './components/CardFlightLayer.jsx';
import {
  getStoredCardTheme,
  setStoredCardTheme,
  getStoredTableTheme,
  setStoredTableTheme,
} from './state/themes.js';
import {
  ensureAudioUnlocked,
  playCardDealSound,
  playCardDrawSound,
  playCardPlaySound,
} from './utils/sound.js';
import { isMobileTouchDevice, tryAutoLandscape } from './utils/orientation.js';
import { useVoiceChat } from './hooks/useVoiceChat.js';

function normalizeGameStateDeadline(payload) {
  if (
    !payload ||
    typeof payload.turnDeadline !== 'number' ||
    typeof payload.serverNow !== 'number'
  ) {
    return payload;
  }
  const remainingMs = Math.max(0, payload.turnDeadline - payload.serverNow);
  return {
    ...payload,
    turnDeadline: Date.now() + remainingMs,
  };
}

// Rule descriptions for cards (rules.md section 4.1 & card.md)
const CARD_RULES_VI = {
  boom: 'Rút phải là bị loại, trừ khi có Kìm Cắt Dây',
  defuse: 'Cứu mạng khi rút phải Mèo Bùm',
  attack: 'Kết thúc lượt không rút, người kế tiếp chơi 2 lượt',
  skip: 'Kết thúc lượt không rút',
  reverse: 'Đổi hướng chơi và kết thúc lượt mà không rút bài',
  shuffle: 'Xáo bộ rút, lượt tiếp tục',
  favor: 'Lấy ngẫu nhiên 1 lá của người khác',
  peek: 'Xem 3 lá trên cùng, chỉ mình thấy',
  nope: 'Chặn bất kỳ hành động nào, trừ lá Mèo Bùm hoặc Kìm Cắt Dây',
  cat: 'Chơi cặp 2 lá, lấy ngẫu nhiên 1 lá của một người',
  taco: 'Chơi cặp 2 lá, lấy ngẫu nhiên 1 lá của một người khác',
  potato: 'Chơi cặp 2 lá, lấy ngẫu nhiên 1 lá của một người khác',
};

const CARD_RULES_EN = {
  boom: 'Eliminated if drawn, unless you have Defuse',
  defuse: 'Saves you from the exploding bomb',
  attack: 'End turn without drawing; next player takes 2 turns',
  skip: 'End turn without drawing',
  reverse: 'Reverse the direction of play and end your turn without drawing',
  shuffle: 'Shuffle the draw pile, turn continues',
  favor: 'Take 1 random card from another player',
  peek: 'Privately view the top 3 cards',
  nope: 'Stop any action except for an Exploding Kitten or a Defuse card',
  cat: 'Play a pair to steal 1 random card from a player',
  taco: 'Play as a pair to steal a random card from another player',
  potato: 'Play as a pair to steal a random card from another player',
};

const CAT_TYPES = ['cat', 'taco', 'potato'];

const CARD_SORT_ORDER = Object.freeze({
  defuse: 0,
  nope: 1,
  attack: 2,
  skip: 3,
  reverse: 4,
  favor: 5,
  peek: 6,
  shuffle: 7,
  cat: 8,
  taco: 9,
  potato: 10,
  boom: 11,
});

const CAT_NAMES_VI = {
  cat: 'Mèo Vằn',
  taco: 'Mèo Taco',
  potato: 'Mèo Khoai Tây',
};

const CAT_NAMES_EN = {
  cat: 'Striped Cat',
  taco: 'Taco Cat',
  potato: 'Hairy Potato Cat',
};

const FALLBACK_CARD_LABELS_VI = {
  nope: 'KHÔNG!',
  reverse: 'Đảo Chiều',
  cat: 'Mèo Vằn',
  taco: 'Mèo Taco',
  potato: 'Mèo Khoai Tây',
};

const FALLBACK_CARD_LABELS_EN = {
  nope: 'Nope',
  reverse: 'Reverse',
  cat: 'Cat',
  taco: 'Tacocat',
  potato: 'Hairy Potato Cat',
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
  const [chatBubbles, setChatBubbles] = useState({});
  const chatBubbleTimersRef = useRef(new Map());
  const [mutedVoiceIds, setMutedVoiceIds] = useState(() => new Set());
  const [mutedChatIds, setMutedChatIds] = useState(() => new Set());
  const toastCounterRef = useRef(0);
  const mutedChatIdsRef = useRef(mutedChatIds);
  useEffect(() => {
    mutedChatIdsRef.current = mutedChatIds;
  }, [mutedChatIds]);

  const showToast = useCallback((payload, variant = 'error') => {
    const id = ++toastCounterRef.current;
    const base =
      typeof payload === 'string'
        ? { code: null, message: payload }
        : payload || {};
    dispatch({
      type: ACTION_TYPES.ERROR_RECEIVED,
      payload: {
        ...base,
        variant: base.variant || variant,
        id,
      },
    });
  }, [dispatch]);

  const handleToggleMuteVoice = useCallback((targetId) => {
    if (!targetId) return;
    setMutedVoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  }, []);

  const handleToggleMuteChat = useCallback((targetId) => {
    if (!targetId) return;
    setMutedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  }, []);

  const handleVoiceError = useCallback(
    (code) => {
      const msg = strings.errors?.[code] || code;
      showToast({ code, message: msg }, 'error');
    },
    [strings, showToast]
  );

  const voiceSocket = useMemo(() => {
    try {
      return getSocket();
    } catch {
      return null;
    }
  }, []);

  const voicePlayers = useMemo(() => {
    return Array.isArray(roomState?.players) ? roomState.players : [];
  }, [roomState?.players]);

  const { micOn, micBusy, voicePeers, toggleMic, stopMic } = useVoiceChat({
    socket: voiceSocket,
    roomCode: roomState?.code || null,
    myPlayerId,
    players: voicePlayers,
    mutedVoiceIds,
    onError: handleVoiceError,
  });

  const visibleChatMessages = useMemo(() => {
    if (!mutedChatIds || mutedChatIds.size === 0) return chatMessages;
    return chatMessages.filter((msg) => !mutedChatIds.has(msg?.playerId));
  }, [chatMessages, mutedChatIds]);

  const visibleChatBubbles = useMemo(() => {
    if (!mutedChatIds || mutedChatIds.size === 0) return chatBubbles;
    const filtered = {};
    for (const [pid, bubble] of Object.entries(chatBubbles)) {
      if (!mutedChatIds.has(pid)) {
        filtered[pid] = bubble;
      }
    }
    return filtered;
  }, [chatBubbles, mutedChatIds]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [cardTheme, setCardTheme] = useState(() => getStoredCardTheme());
  const [tableTheme, setTableTheme] = useState(() => getStoredTableTheme());
  const [cardFlights, setCardFlights] = useState([]);
  const flightIdRef = useRef(0);
  const lastSelectedCardRectRef = useRef(null);
  const prevAnimSnapshotRef = useRef(null);

  const handleSelectCardTheme = useCallback((nextTheme) => {
    setCardTheme(nextTheme);
    setStoredCardTheme(nextTheme);
  }, []);

  const handleSelectTableTheme = useCallback((nextTheme) => {
    setTableTheme(nextTheme);
    setStoredTableTheme(nextTheme);
  }, []);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedLocale = localStorage.getItem('meo-no:locale');
        if (savedLocale === 'en' || savedLocale === 'vi') {
          dispatch({ type: ACTION_TYPES.LOCALE_CHANGED, payload: savedLocale });
        }
      }
    } catch {}
  }, [dispatch]);

  const handleToggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    dispatch({ type: ACTION_TYPES.LOCALE_CHANGED, payload: nextLocale });
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('meo-no:locale', nextLocale);
      }
    } catch {}
  }, [locale, dispatch]);

  // Local UI-only interaction state
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [targetPickerAction, setTargetPickerAction] = useState(null); // 'favor' | 'catPair'
  const [insertAt, setInsertAt] = useState(0);
  const [dismissedPeekVersion, setDismissedPeekVersion] = useState(null);

  // Keep playerId up to date and unlock Web Audio on first user interaction
  useEffect(() => {
    ensureAudioUnlocked();
    const id = getOrCreatePlayerId();
    if (id && id !== myPlayerId) {
      setMyPlayerId(id);
    }
  }, [myPlayerId]);

  // On mobile touch devices, automatically request landscape orientation when entering game
  useEffect(() => {
    if (screen !== 'game' || !isMobileTouchDevice()) return undefined;
    tryAutoLandscape();
    const handleFirstTap = () => {
      tryAutoLandscape();
    };
    window.addEventListener('pointerdown', handleFirstTap, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstTap);
    };
  }, [screen]);

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
              dispatch({
                type: ACTION_TYPES.GAME_STATE_RECEIVED,
                payload: normalizeGameStateDeadline(ack.game),
              });
            }
          } else {
            clearStoredRoomCode();
            dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
            if (ack?.code) {
              const msg = strings.errors?.[ack.code] || ack.message || ack.code;
              showToast({ code: ack.code, message: msg }, 'error');
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
  }, [dispatch, strings, showToast]);

  // 2. Subscribe to server -> client socket events
  useEffect(() => {
    const socket = getSocket();

    const handleRoomState = (payload) => {
      dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload });
    };

    const handleGameState = (payload) => {
      dispatch({
        type: ACTION_TYPES.GAME_STATE_RECEIVED,
        payload: normalizeGameStateDeadline(payload),
      });
    };

    const handleGameError = (error) => {
      const message =
        (error?.code ? strings.errors?.[error.code] : null) ||
        error?.message ||
        strings.errors?.SERVER_ERROR ||
        (locale === 'en' ? 'An error occurred' : 'Có lỗi xảy ra');
      showToast({ code: error?.code, message }, 'error');
    };

    const handleSessionReplaced = () => {
      clearStoredRoomCode();
      dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
      showToast(
        {
          code: 'SESSION_REPLACED',
          message:
            strings.errors?.SESSION_REPLACED ||
            (locale === 'en'
              ? 'Your session was opened in another tab or device'
              : 'Phiên kết nối đã được mở ở một tab hoặc thiết bị khác'),
        },
        'error'
      );
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
                dispatch({
                  type: ACTION_TYPES.GAME_STATE_RECEIVED,
                  payload: normalizeGameStateDeadline(ack.game),
                });
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
      if (msg?.playerId && msg?.text && !mutedChatIdsRef.current.has(msg.playerId)) {
        const bubbleId = `${msg.playerId}-${Date.now()}-${Math.random()}`;
        setChatBubbles((prev) => ({
          ...prev,
          [msg.playerId]: { text: msg.text, at: msg.at || Date.now(), id: bubbleId },
        }));

        const existingTimer = chatBubbleTimersRef.current.get(msg.playerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const timerId = setTimeout(() => {
          chatBubbleTimersRef.current.delete(msg.playerId);
          setChatBubbles((prev) => {
            if (prev[msg.playerId]?.id !== bubbleId) return prev;
            const next = { ...prev };
            delete next[msg.playerId];
            return next;
          });
        }, 4500);
        chatBubbleTimersRef.current.set(msg.playerId, timerId);
      }
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
  }, [dispatch, strings, locale, showToast]);

  useEffect(() => {
    const timers = chatBubbleTimersRef.current;
    return () => {
      for (const timerId of timers.values()) {
        clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  // Safety resync if the turn deadline passed without receiving a state update
  // (e.g. background-throttled browser tab or missed broadcast during a blip)
  const lastResyncVersionRef = useRef(null);
  useEffect(() => {
    if (
      screen !== 'game' ||
      !socketConnected ||
      !roomState?.code ||
      !myPlayerId ||
      !gameState ||
      gameState.phase === 'over' ||
      typeof gameState.turnDeadline !== 'number'
    ) {
      return;
    }

    const version = gameState.version;
    const delayMs = Math.max(0, gameState.turnDeadline - Date.now()) + 2000;
    const timerId = setTimeout(() => {
      if (lastResyncVersionRef.current === version) return;
      lastResyncVersionRef.current = version;
      emitWithAck('room:resume', { playerId: myPlayerId, code: roomState.code })
        .then((ack) => {
          if (ack?.ok && ack.game) {
            dispatch({
              type: ACTION_TYPES.GAME_STATE_RECEIVED,
              payload: normalizeGameStateDeadline(ack.game),
            });
          }
        })
        .catch(() => {});
    }, delayMs);

    return () => clearTimeout(timerId);
  }, [
    screen,
    socketConnected,
    roomState?.code,
    myPlayerId,
    gameState,
    dispatch,
  ]);

  const handleSendChat = useCallback((text) => {
    emitWithAck('chat:message', { text }).catch(() => {});
  }, []);

  // Derived toast message & dismiss callback
  const toastText = useMemo(() => {
    if (!toast) return null;
    if (typeof toast === 'string') return toast;
    if (typeof toast === 'object') {
      if (toast.code && strings.errors?.[toast.code]) {
        return strings.errors[toast.code];
      }
      if (toast.message) return toast.message;
      if (toast.code) return toast.code;
    }
    return String(toast);
  }, [toast, strings]);

  const toastVariant =
    toast && typeof toast === 'object' && toast.variant ? toast.variant : 'error';
  const toastKey =
    toast && typeof toast === 'object' && toast.id !== undefined ? toast.id : toastText;
  const toastCloseLabel =
    strings.toast?.closeAriaLabel ||
    (locale === 'en' ? 'Dismiss notification' : 'Đóng thông báo');

  const handleDismissToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.TOAST_CLEARED });
  }, [dispatch]);

  const fallbackCardLabels = useMemo(
    () => (locale === 'en' ? FALLBACK_CARD_LABELS_EN : FALLBACK_CARD_LABELS_VI),
    [locale]
  );

  // Card renderer matching Card.jsx props
  const renderCard = useCallback(
    (cardProps) => {
      if (!cardProps) return null;
      const { id, type, key, ...restProps } = cardProps;
      const cardType = type || 'cat';
      const label =
        cardProps.label ||
        strings.cards?.[cardType] ||
        fallbackCardLabels[cardType] ||
        cardType;
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
          locale={locale}
          cardTheme={cardTheme}
          {...restProps}
        />
      );
    },
    [strings, locale, fallbackCardLabels, cardTheme]
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
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        ack?.message ||
        strings.errors?.CREATE_ROOM_FAILED ||
        (locale === 'en' ? 'Unable to create room' : 'Không thể tạo phòng');
      showToast({ code: ack?.code, message: msg }, 'error');
    }
  }, [name, strings, locale, showToast]);

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
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        ack?.message ||
        strings.errors?.JOIN_ROOM_FAILED ||
        (locale === 'en' ? 'Unable to join room' : 'Không thể vào phòng');
      showToast({ code: ack?.code, message: msg }, 'error');
    }
  }, [name, joinCode, strings, locale, showToast]);

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
      ? strings.lobby?.needTwoPlayers ||
        (locale === 'en'
          ? 'At least 2 connected players are needed to start'
          : 'Cần ít nhất 2 người đang kết nối để bắt đầu')
      : undefined;

  const handleStartGame = useCallback(async () => {
    const ack = await emitWithAck('game:start', {});
    if (!ack?.ok) {
      const msg =
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        ack?.message ||
        strings.errors?.START_GAME_FAILED ||
        (locale === 'en' ? 'Unable to start game' : 'Không thể bắt đầu ván');
      showToast({ code: ack?.code, message: msg }, 'error');
    }
  }, [strings, locale, showToast]);

  const handleLeaveRoom = useCallback(async () => {
    stopMic();
    try {
      await emitWithAck('room:leave', {});
    } catch {}
    clearStoredRoomCode();
    setChatMessages([]);
    setMutedVoiceIds(new Set());
    setMutedChatIds(new Set());
    for (const timerId of chatBubbleTimersRef.current.values()) {
      clearTimeout(timerId);
    }
    chatBubbleTimersRef.current.clear();
    setChatBubbles({});
    dispatch({ type: ACTION_TYPES.ROOM_STATE_RECEIVED, payload: null });
  }, [dispatch, stopMic]);

  const handleCopyCode = useCallback(async () => {
    if (!roomState?.code) return;
    try {
      await navigator.clipboard.writeText(roomState.code);
      const copiedMsg =
        typeof strings.toast?.copiedCode === 'function'
          ? strings.toast.copiedCode(roomState.code)
          : locale === 'en'
            ? `Copied room code ${roomState.code}`
            : `Đã sao chép mã phòng ${roomState.code}`;
      showToast({ code: null, message: copiedMsg }, 'success');
    } catch {}
  }, [roomState?.code, strings, locale, showToast]);

  const handleShareCode = useCallback(async () => {
    if (!roomState?.code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title:
            strings.lobby?.shareTitle ||
            (locale === 'en' ? 'Exploding Kittens' : 'Mèo Nổ'),
          text: strings.lobby?.shareText
            ? strings.lobby.shareText(roomState.code)
            : locale === 'en'
              ? `Exploding Kittens room code: ${roomState.code}`
              : `Mã phòng Mèo Nổ: ${roomState.code}`,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(roomState.code);
        const copiedMsg =
          typeof strings.toast?.copiedCode === 'function'
            ? strings.toast.copiedCode(roomState.code)
            : locale === 'en'
              ? `Copied room code ${roomState.code}`
              : `Đã sao chép mã phòng ${roomState.code}`;
        showToast({ code: null, message: copiedMsg }, 'success');
      }
    } catch {}
  }, [roomState?.code, strings, locale, showToast]);

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

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      if (!entry || entry.type === 'action_cancelled' || entry.cancelled) continue;
      if (entry.target !== myPlayerId || entry.actor === myPlayerId) continue;

      const wasCancelledInBatch = newEntries.slice(i + 1).some(
        (later) =>
          later?.type === 'action_cancelled' &&
          later.actor === entry.actor &&
          (!later.card || later.card === entry.card || entry.type === 'cat')
      );
      if (wasCancelledInBatch) continue;

      const actorPlayer = mergedGamePlayers.find((p) => p.id === entry.actor);
      const actorName = actorPlayer?.name || entry.actor;

      let message = null;
      if (entry.type === 'attack') {
        message =
          locale === 'en'
            ? `${actorName} played Attack — you must take extra turns!`
            : `${actorName} vừa đánh Truy Đuổi — bạn sẽ phải chơi thêm lượt!`;
      } else if (entry.type === 'favor') {
        message =
          locale === 'en'
            ? `${actorName} played Favor — they took 1 random card from your hand.`
            : `${actorName} vừa Nài Nỉ — họ đã lấy ngẫu nhiên 1 lá từ tay bạn.`;
      } else if (entry.type === 'cat') {
        const catName =
          locale === 'en'
            ? strings.cards?.[entry.card] || CAT_NAMES_EN[entry.card] || 'Cat'
            : strings.cards?.[entry.card] || CAT_NAMES_VI[entry.card] || 'Mèo Vằn';
        message =
          locale === 'en'
            ? `${actorName} played a ${catName} pair targeting you — they took 1 random card from your hand.`
            : `${actorName} vừa chơi cặp ${catName} nhắm vào bạn — họ đã lấy ngẫu nhiên 1 lá từ tay bạn.`;
      }
      if (message) {
        showToast({ code: null, message }, 'warning');
        break; // one toast at a time; if several targeted us in one update, the log panel has the rest
      }
    }
  }, [gameState?.log, myPlayerId, mergedGamePlayers, locale, strings.cards, showToast]);

  const isMyTurn =
    gameState?.phase === 'play' &&
    gameState?.currentPlayerId === myPlayerId &&
    myPlayer?.alive !== false;

  const isNopePhase = gameState?.phase === 'nope' && Boolean(gameState?.pendingAction);

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

  const currentTurnPlayerName = useMemo(() => {
    if (!gameState?.currentPlayerId) return null;
    const player = mergedGamePlayers.find((p) => p.id === gameState.currentPlayerId);
    return player?.name || gameState.currentPlayerId;
  }, [gameState?.currentPlayerId, mergedGamePlayers]);

  const actionBarCountdownFormatter = useMemo(() => {
    const isEn = locale === 'en';
    if (isMyTurn || isNopePhase) {
      return (s) => (isEn ? `${s}s left` : `Còn ${s} giây`);
    }
    if (otherDefusingName) {
      return (s) =>
        isEn
          ? `${otherDefusingName} defusing — ${s}s`
          : `${otherDefusingName} gỡ bom — Còn ${s} giây`;
    }
    if (currentTurnPlayerName) {
      return (s) =>
        isEn
          ? `${currentTurnPlayerName}'s turn — ${s}s left`
          : `Lượt của ${currentTurnPlayerName} — Còn ${s} giây`;
    }
    return (s) => (isEn ? `${s}s left` : `Còn ${s} giây`);
  }, [locale, isMyTurn, isNopePhase, otherDefusingName, currentTurnPlayerName]);

  // Reset transient game UI state when leaving/rematching a game
  useEffect(() => {
    if (!gameState) {
      setSelectedCardIds(new Set());
      setTargetPickerOpen(false);
      setTargetPickerAction(null);
      setInsertAt(0);
      setDismissedPeekVersion(null);
      setCardFlights([]);
      lastSelectedCardRectRef.current = null;
      prevAnimSnapshotRef.current = null;
      lastSeenLogLengthRef.current = 0;
    }
  }, [gameState]);

  // Card flight animations (deal, draw-to-hand, play-to-table) + sound effects
  useEffect(() => {
    if (screen !== 'game' || !gameState) {
      prevAnimSnapshotRef.current = null;
      return undefined;
    }

    const log = Array.isArray(gameState.log) ? gameState.log : [];
    const discardCount = gameState.discardCount ?? 0;
    const discardTop = gameState.discardTop ?? null;
    const prev = prevAnimSnapshotRef.current;

    const nextSnapshot = {
      version: gameState.version,
      discardCount,
      discardTop,
      logLen: log.length,
      currentPlayerId: gameState.currentPlayerId,
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scheduleFlights = (newFlights) => {
      if (!newFlights.length || reducedMotion) return;
      setCardFlights((current) => [...current, ...newFlights]);
      const maxEnd = newFlights.reduce(
        (acc, f) => Math.max(acc, (f.delayMs || 0) + (f.durationMs || 380)),
        0
      );
      const ids = new Set(newFlights.map((f) => f.id));
      setTimeout(() => {
        setCardFlights((current) => current.filter((f) => !ids.has(f.id)));
      }, maxEnd + 100);
    };

    const makeFlight = (fromRect, toRect, opts = {}) => {
      if (!fromRect || !toRect || fromRect.width <= 0 || toRect.width <= 0) return null;
      const fromCenterX = fromRect.left + fromRect.width / 2;
      const fromCenterY = fromRect.top + fromRect.height / 2;
      const toCenterX = toRect.left + toRect.width / 2;
      const toCenterY = toRect.top + toRect.height / 2;
      const id = ++flightIdRef.current;
      return {
        id,
        fromX: fromRect.left,
        fromY: fromRect.top,
        fromW: fromRect.width,
        fromH: fromRect.height,
        dx: toCenterX - fromCenterX,
        dy: toCenterY - fromCenterY,
        scaleEnd: Number((toRect.width / fromRect.width).toFixed(3)) || 1,
        ...opts,
      };
    };

    // 1. Fresh game start: deal cards flying from DrawPile into hand & opponent seats
    if (!prev && (gameState.version === 0 || log.length === 0)) {
      const rafId = window.requestAnimationFrame(() => {
        prevAnimSnapshotRef.current = nextSnapshot;
        if (typeof document === 'undefined') return;
        const drawRect = document
          .querySelector('[data-testid="draw-pile"] .draw-pile__card')
          ?.getBoundingClientRect();
        const handSlots = Array.from(document.querySelectorAll('.hand-card-slot'));
        playCardDealSound(handSlots.length || 5);

        if (!drawRect || drawRect.width <= 0) return;
        const created = [];
        handSlots.forEach((slotEl, idx) => {
          const toRect = slotEl.getBoundingClientRect();
          const flight = makeFlight(drawRect, toRect, {
            variant: 'deal',
            faceDown: true,
            delayMs: idx * 85,
            durationMs: 360,
            rotateStart: -8 + idx * 2,
            rotateEnd: 0,
          });
          if (flight) created.push(flight);
        });

        const opponents = (gameState.players || []).filter((p) => p?.id && p.id !== myPlayerId);
        opponents.forEach((opp, idx) => {
          const seatRect = document
            .querySelector(`[data-testid="seat-${opp.id}"]`)
            ?.getBoundingClientRect();
          if (!seatRect || seatRect.width <= 0) return;
          const targetBox = {
            left: seatRect.left + seatRect.width / 2 - 22,
            top: seatRect.top + seatRect.height / 2 - 31,
            width: 44,
            height: 62,
          };
          const flight = makeFlight(drawRect, targetBox, {
            variant: 'deal',
            faceDown: true,
            delayMs: 100 + idx * 90,
            durationMs: 340,
            rotateStart: 6,
            rotateEnd: 0,
          });
          if (flight) created.push(flight);
        });

        scheduleFlights(created);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    if (!prev) {
      prevAnimSnapshotRef.current = nextSnapshot;
      return undefined;
    }

    if (gameState.version <= prev.version) {
      return undefined;
    }

    const startIdx = log.length >= prev.logLen ? prev.logLen : 0;
    const newEntries = log.slice(startIdx);
    const drawEntry = [...newEntries].reverse().find((e) => e?.type === 'draw' || e?.type === 'bomb_drawn');
    const playedToDiscard = discardCount > prev.discardCount && Boolean(discardTop);

    const rafId = window.requestAnimationFrame(() => {
      prevAnimSnapshotRef.current = nextSnapshot;
      if (typeof document === 'undefined') return;
      const created = [];

      // 2. Card drawn -> flies from DrawPile into hand (or opponent seat)
      if (drawEntry) {
        playCardDrawSound();
        const drawRect = document
          .querySelector('[data-testid="draw-pile"] .draw-pile__card')
          ?.getBoundingClientRect();
        if (drawRect && drawRect.width > 0) {
          let targetRect = null;
          if (drawEntry.actor === myPlayerId) {
            const slots = document.querySelectorAll('.hand-card-slot');
            if (slots.length > 0) {
              targetRect = slots[slots.length - 1].getBoundingClientRect();
            } else {
              const strip = document.querySelector('.hand-scroll-strip')?.getBoundingClientRect();
              if (strip && strip.width > 0) {
                targetRect = {
                  left: strip.left + strip.width / 2 - drawRect.width / 2,
                  top: strip.top + 12,
                  width: drawRect.width,
                  height: drawRect.height,
                };
              }
            }
          } else if (drawEntry.actor) {
            const seatRect = document
              .querySelector(`[data-testid="seat-${drawEntry.actor}"]`)
              ?.getBoundingClientRect();
            if (seatRect && seatRect.width > 0) {
              targetRect = {
                left: seatRect.left + seatRect.width / 2 - 22,
                top: seatRect.top + seatRect.height / 2 - 31,
                width: 44,
                height: 62,
              };
            }
          }
          const flight = makeFlight(drawRect, targetRect, {
            variant: 'draw',
            faceDown: true,
            delayMs: 0,
            durationMs: 360,
            rotateStart: -6,
            rotateEnd: 0,
          });
          if (flight) created.push(flight);
        }
      }

      // 3. Card played -> flies face-up onto DiscardPile with tabletop slap sound
      if (playedToDiscard) {
        playCardPlaySound();
        const discardRect = document
          .querySelector('[data-testid="discard-pile"] .discard-pile__slot')
          ?.getBoundingClientRect();
        if (discardRect && discardRect.width > 0) {
          const playLogTypes = new Set([
            'nope',
            'defused',
            'skip',
            'attack',
            'reverse',
            'shuffle',
            'peek',
            'favor',
            'cat',
          ]);
          const playEntry = [...newEntries].reverse().find((e) => playLogTypes.has(e?.type));
          const throwerId =
            gameState.phase === 'nope' && gameState.pendingAction?.lastActorId
              ? gameState.pendingAction.lastActorId
              : playEntry?.actor || prev.currentPlayerId;

          let fromRect = null;
          if (throwerId === myPlayerId) {
            fromRect = lastSelectedCardRectRef.current;
            lastSelectedCardRectRef.current = null;
            if (!fromRect) {
              const strip = document.querySelector('.hand-scroll-strip')?.getBoundingClientRect();
              if (strip && strip.width > 0) {
                fromRect = {
                  left: strip.left + strip.width / 2 - discardRect.width / 2,
                  top: strip.top + 8,
                  width: discardRect.width,
                  height: discardRect.height,
                };
              }
            }
          } else if (throwerId) {
            const seatRect = document
              .querySelector(`[data-testid="seat-${throwerId}"]`)
              ?.getBoundingClientRect();
            if (seatRect && seatRect.width > 0) {
              fromRect = {
                left: seatRect.left + seatRect.width / 2 - 26,
                top: seatRect.top + seatRect.height / 2 - 36,
                width: 52,
                height: 73,
              };
            }
          }

          const cardLabel =
            strings.cards?.[discardTop] || fallbackCardLabels[discardTop] || discardTop;
          const cardRuleText =
            (locale === 'en' ? CARD_RULES_EN[discardTop] : CARD_RULES_VI[discardTop]) || '';

          const flight = makeFlight(fromRect, discardRect, {
            variant: 'play',
            faceDown: false,
            cardType: discardTop,
            cardLabel,
            cardRuleText,
            delayMs: 0,
            durationMs: 340,
            rotateStart: throwerId === myPlayerId ? -6 : 6,
            rotateEnd: 0,
          });
          if (flight) created.push(flight);
        }
      }

      scheduleFlights(created);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [screen, gameState, myPlayerId, strings.cards, fallbackCardLabels, locale]);

  // Build hand cards array with stable unique IDs, automatically grouped/sorted by card type
  const myHandCards = useMemo(() => {
    if (!myPlayer || !Array.isArray(myPlayer.hand)) return [];
    const typeCounts = Object.create(null);
    const mapped = myPlayer.hand.map((cardItem, index) => {
      const type = typeof cardItem === 'string' ? cardItem : cardItem.type;
      const occ = typeCounts[type] || 0;
      typeCounts[type] = occ + 1;
      const id =
        typeof cardItem === 'object' && cardItem?.id
          ? cardItem.id
          : `hand-card-${type}-${occ}`;
      return {
        id,
        type,
        index,
      };
    });
    return mapped.sort((a, b) => {
      const orderA = CARD_SORT_ORDER[a.type] ?? 99;
      const orderB = CARD_SORT_ORDER[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    });
  }, [myPlayer]);

  // Group cat cards by breed (3 breeds: cat, taco, potato)
  const catCardsByType = useMemo(() => {
    const grouped = { cat: [], taco: [], potato: [] };
    for (const card of myHandCards) {
      if (CAT_TYPES.includes(card.type)) {
        grouped[card.type].push(card);
      }
    }
    return grouped;
  }, [myHandCards]);

  const hasCatPair = CAT_TYPES.some((type) => catCardsByType[type].length >= 2);

  const candidates = useMemo(() => {
    return mergedGamePlayers
      .filter((p) => p.id !== myPlayerId && p.alive !== false)
      .map((p) => ({ id: p.id, name: p.name || p.id }));
  }, [mergedGamePlayers, myPlayerId]);

  const playableCardIds = useMemo(() => {
    if (!socketConnected) {
      return new Set();
    }
    if (isNopePhase) {
      if (
        myPlayer?.alive !== false &&
        gameState?.pendingAction?.lastActorId !== myPlayerId
      ) {
        return new Set(
          myHandCards
            .filter((c) => c.type === 'nope')
            .map((c) => c.id)
        );
      }
      return new Set();
    }
    if (!isMyTurn) {
      return new Set();
    }
    const playableTypes = new Set(['skip', 'attack', 'reverse', 'shuffle', 'peek']);
    if (candidates.length > 0) {
      playableTypes.add('favor');
      for (const catType of CAT_TYPES) {
        if (catCardsByType[catType].length >= 2) {
          playableTypes.add(catType);
        }
      }
    }
    return new Set(
      myHandCards
        .filter((c) => playableTypes.has(c.type))
        .map((c) => c.id)
    );
  }, [
    socketConnected,
    isNopePhase,
    isMyTurn,
    myPlayer?.alive,
    gameState?.pendingAction?.lastActorId,
    myPlayerId,
    myHandCards,
    candidates.length,
    catCardsByType,
  ]);

  // Explains WHY a specific disabled card can't be played, mirroring the
  // exact logic playableCardIds uses above -- passed to Hand's optional
  // getDisabledReason prop so a tap on a dimmed card shows a real reason
  // instead of just doing nothing.
  const getDisabledReason = useCallback(
    (card) => {
      const isEn = locale === 'en';
      if (!socketConnected) {
        return isEn
          ? 'Connection lost, please wait'
          : 'Đang mất kết nối, vui lòng chờ';
      }
      if (card?.type === 'nope') {
        if (!isNopePhase) {
          return isEn
            ? 'Nope can only be played while an action is pending'
            : 'Chỉ dùng được lá KHÔNG! khi có hành động đang chờ phản ứng';
        }
        if (myPlayer?.alive === false) {
          return isEn
            ? 'You have been eliminated and cannot play cards'
            : 'Bạn đã bị loại, không thể đánh bài';
        }
        if (gameState?.pendingAction?.lastActorId === myPlayerId) {
          return isEn
            ? 'You cannot Nope your own action'
            : 'Không thể tự chặn hành động của chính mình';
        }
      }
      if (isNopePhase) {
        return isEn
          ? 'Only Nope can be played during the Nope reaction window'
          : 'Đang trong thời gian phản ứng KHÔNG!, chỉ có thể dùng lá KHÔNG!';
      }
      if (!isMyTurn) return isEn ? 'Not your turn' : 'Chưa đến lượt bạn';
      if (card?.type === 'defuse') {
        return isEn
          ? 'Defuse cannot be played directly — it only saves you when drawing an Exploding Kitten'
          : 'Không thể đánh lá Kìm Cắt Dây riêng — chỉ dùng khi rút phải Mèo Bùm';
      }
      if (card?.type === 'boom') {
        return isEn
          ? 'Exploding Kitten cannot be played directly'
          : 'Không thể đánh lá Mèo Bùm riêng';
      }
      if (CAT_TYPES.includes(card?.type)) {
        const catName = isEn
          ? strings.cards?.[card.type] || CAT_NAMES_EN[card.type] || 'Cat'
          : strings.cards?.[card.type] || CAT_NAMES_VI[card.type] || 'Mèo';
        if (catCardsByType[card.type].length < 2) {
          return isEn
            ? `You need at least 2 matching ${catName} cards to play a pair`
            : `Cần có ít nhất 2 lá ${catName} giống nhau để chơi cặp`;
        }
        if (candidates.length === 0) {
          return isEn
            ? 'No living players left to target'
            : 'Không còn người chơi nào để nhắm mục tiêu';
        }
      }
      if (card?.type === 'favor' && candidates.length === 0) {
        return isEn
          ? 'No living players left to target'
          : 'Không còn người chơi nào để nhắm mục tiêu';
      }
      return isEn
        ? 'This card cannot be played right now'
        : 'Lá này không thể đánh lúc này';
    },
    [
      locale,
      strings.cards,
      socketConnected,
      isNopePhase,
      myPlayer?.alive,
      gameState?.pendingAction?.lastActorId,
      myPlayerId,
      isMyTurn,
      catCardsByType,
      candidates.length,
    ]
  );

  // ActionBar availability flags & handlers
  const sendGameAction = useCallback(
    async (payload) => {
      const ack = await emitWithAck('game:action', payload);
      if (!ack?.ok) {
        const msg =
          (ack?.code ? strings.errors?.[ack.code] : null) ||
          ack?.message ||
          strings.errors?.INVALID_ACTION ||
          (locale === 'en' ? 'Invalid action' : 'Hành động không hợp lệ');
        showToast({ code: ack?.code, message: msg }, 'error');
      }
      return ack;
    },
    [strings, locale, showToast]
  );

  const canDraw = isMyTurn && socketConnected;
  const canSkip = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'skip');
  const canAttack = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'attack');
  const canReverse = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'reverse');
  const canFavor =
    isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'favor') && candidates.length > 0;
  const canCatPair = isMyTurn && socketConnected && hasCatPair && candidates.length > 0;
  const canPeek = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'peek');
  const canShuffle = isMyTurn && socketConnected && myHandCards.some((c) => c.type === 'shuffle');

  const canNope =
    isNopePhase &&
    socketConnected &&
    myPlayer?.alive !== false &&
    gameState.pendingAction.lastActorId !== myPlayerId &&
    myHandCards.some((c) => c.type === 'nope');

  const canPassNope =
    isNopePhase &&
    socketConnected &&
    myPlayer?.alive !== false &&
    gameState.pendingAction.lastActorId !== myPlayerId &&
    !(gameState.pendingAction.passedIds || []).includes(myPlayerId);

  const nopePromptText = useMemo(() => {
    if (!isNopePhase || !gameState?.pendingAction) return '';
    const isEn = locale === 'en';
    const pa = gameState.pendingAction;
    const lastActor = pa.lastActorId;
    if (lastActor === myPlayerId) {
      return isEn
        ? 'Waiting for other players to react with Nope…'
        : 'Đang chờ người chơi khác phản ứng KHÔNG!…';
    }
    if ((pa.passedIds || []).includes(myPlayerId)) {
      return isEn
        ? 'You passed — waiting for other players…'
        : 'Bạn đã cho qua — đang chờ người chơi khác…';
    }
    const lastActorName =
      mergedGamePlayers.find((p) => p.id === lastActor)?.name ||
      lastActor ||
      (isEn ? 'Player' : 'Người chơi');
    const actionCard =
      pa.card ||
      pa.action?.card ||
      (pa.type === 'catPair' || pa.action?.type === 'catPair' ? 'cat' : null);
    const cardLabel = actionCard
      ? strings.cards?.[actionCard] || fallbackCardLabels[actionCard] || actionCard
      : null;

    if ((pa.nopeCount || 0) > 0) {
      return isEn
        ? `${lastActorName} played Nope! — Counter with Nope?`
        : `${lastActorName} vừa đánh KHÔNG! — Bạn có muốn KHÔNG! lại không?`;
    }
    if (cardLabel) {
      return isEn
        ? `${lastActorName} played ${cardLabel} — Cancel with Nope?`
        : `${lastActorName} vừa đánh ${cardLabel} — Chặn bằng KHÔNG!?`;
    }
    return isEn
      ? `${lastActorName} performed an action — Cancel with Nope?`
      : `${lastActorName} vừa thực hiện hành động — Chặn bằng KHÔNG!?`;
  }, [isNopePhase, gameState?.pendingAction, myPlayerId, mergedGamePlayers, strings.cards, fallbackCardLabels, locale]);

  const handleDrawAction = useCallback(async () => {
    if (!canDraw) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'draw' });
  }, [canDraw, sendGameAction]);

  const handleSkipAction = useCallback(async () => {
    if (!canSkip) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'play', card: 'skip' });
  }, [canSkip, sendGameAction]);

  const handleAttackAction = useCallback(async () => {
    if (!canAttack) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'play', card: 'attack' });
  }, [canAttack, sendGameAction]);

  const handleReverseAction = useCallback(async () => {
    if (!canReverse) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'play', card: 'reverse' });
  }, [canReverse, sendGameAction]);

  const handleShuffleAction = useCallback(async () => {
    if (!canShuffle) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'play', card: 'shuffle' });
  }, [canShuffle, sendGameAction]);

  const handlePeekAction = useCallback(async () => {
    if (!canPeek) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'play', card: 'peek' });
  }, [canPeek, sendGameAction]);

  const handleNopeAction = useCallback(async () => {
    if (!canNope) return;
    setSelectedCardIds(new Set());
    await sendGameAction({ type: 'nope' });
  }, [canNope, sendGameAction]);

  const handlePassNopeAction = useCallback(async () => {
    if (!canPassNope) return;
    await sendGameAction({ type: 'passNope' });
  }, [canPassNope, sendGameAction]);

  const handleToggleSelectCard = useCallback(
    (cardId) => {
      if (typeof document !== 'undefined') {
        const el = document.querySelector(`[data-card-id="${cardId}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            lastSelectedCardRectRef.current = {
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
            };
          }
        }
      }
      const clickedCard = myHandCards.find((c) => c.id === cardId);
      if (isNopePhase && clickedCard?.type === 'nope') {
        handleNopeAction();
        return;
      }
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else if (clickedCard && CAT_TYPES.includes(clickedCard.type)) {
          for (const selId of next) {
            const selCard = myHandCards.find((c) => c.id === selId);
            if (selCard?.type !== clickedCard.type) {
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
        return next;
      });
    },
    [myHandCards, isNopePhase, handleNopeAction]
  );

  // Clear card selection whenever turn moves away from the player
  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardIds((prev) => (prev.size > 0 ? new Set() : prev));
    }
  }, [isMyTurn]);

  const handleFavorAction = useCallback(async () => {
    if (!canFavor) return;
    // In a 2-player game (or 2 survivors left), auto-target the only opponent
    if (candidates.length === 1) {
      setSelectedCardIds(new Set());
      await sendGameAction({
        type: 'play',
        card: 'favor',
        target: candidates[0].id,
      });
      return;
    }
    setTargetPickerAction({ mode: 'favor' });
    setTargetPickerOpen(true);
  }, [canFavor, candidates, sendGameAction]);

  const handleCatPairAction = useCallback(async () => {
    if (!canCatPair) return;
    const selectedCards = myHandCards.filter((c) => selectedCardIds.has(c.id));
    let selectedBreed = null;
    if (
      selectedCards.length === 2 &&
      CAT_TYPES.includes(selectedCards[0].type) &&
      selectedCards[0].type === selectedCards[1].type
    ) {
      selectedBreed = selectedCards[0].type;
    } else {
      selectedBreed = CAT_TYPES.find((type) => catCardsByType[type].length >= 2) || null;
      if (!selectedBreed) return;
      const pair = catCardsByType[selectedBreed];
      setSelectedCardIds(new Set([pair[0].id, pair[1].id]));
    }
    // In a 2-player game (or 2 survivors left), auto-target the only opponent
    if (candidates.length === 1) {
      setSelectedCardIds(new Set());
      await sendGameAction({
        type: 'catPair',
        card: selectedBreed,
        target: candidates[0].id,
      });
      return;
    }
    setTargetPickerAction({ mode: 'catPair', card: selectedBreed });
    setTargetPickerOpen(true);
  }, [canCatPair, myHandCards, selectedCardIds, catCardsByType, candidates, sendGameAction]);

  // Map currently selected hand card(s) directly to the matching game action
  const selectedPlaySpec = useMemo(() => {
    if (!isMyTurn || selectedCardIds.size === 0) {
      return { canPlay: false, label: null, run: null };
    }
    const selected = myHandCards.filter((c) => selectedCardIds.has(c.id));
    if (selected.length === 0) {
      return { canPlay: false, label: null, run: null };
    }

    const cardLabel = (type) =>
      strings.cards?.[type] || fallbackCardLabels[type] || type;

    if (
      selected.length === 2 &&
      CAT_TYPES.includes(selected[0].type) &&
      selected[0].type === selected[1].type
    ) {
      const catName = cardLabel(selected[0].type);
      return {
        canPlay: socketConnected && candidates.length > 0,
        label: locale === 'en' ? `Play ${catName} pair` : `Đánh cặp ${catName}`,
        run: handleCatPairAction,
      };
    }

    if (selected.length === 1) {
      const card = selected[0];
      const name = cardLabel(card.type);
      if (CAT_TYPES.includes(card.type)) {
        return {
          canPlay: false,
          label: locale === 'en' ? `Select 1 more ${name}` : `Chọn thêm 1 ${name}`,
          run: null,
        };
      }
      const singleHandlers = {
        skip: { enabled: canSkip, fn: handleSkipAction },
        attack: { enabled: canAttack, fn: handleAttackAction },
        reverse: { enabled: canReverse, fn: handleReverseAction },
        shuffle: { enabled: canShuffle, fn: handleShuffleAction },
        peek: { enabled: canPeek, fn: handlePeekAction },
        favor: { enabled: canFavor, fn: handleFavorAction },
      };
      const entry = singleHandlers[card.type];
      if (entry) {
        return {
          canPlay: Boolean(entry.enabled),
          label: locale === 'en' ? `Play ${name}` : `Đánh ${name}`,
          run: entry.fn,
        };
      }
    }

    return { canPlay: false, label: null, run: null };
  }, [
    isMyTurn,
    selectedCardIds,
    myHandCards,
    strings.cards,
    fallbackCardLabels,
    socketConnected,
    candidates.length,
    locale,
    handleCatPairAction,
    canSkip,
    handleSkipAction,
    canAttack,
    handleAttackAction,
    canReverse,
    handleReverseAction,
    canShuffle,
    handleShuffleAction,
    canPeek,
    handlePeekAction,
    canFavor,
    handleFavorAction,
  ]);

  const handlePickTarget = useCallback(
    async (targetPlayerId) => {
      setTargetPickerOpen(false);
      const pendingTargetAction = targetPickerAction;
      setTargetPickerAction(null);

      if (pendingTargetAction?.mode === 'favor' || pendingTargetAction === 'favor') {
        await sendGameAction({
          type: 'play',
          card: 'favor',
          target: targetPlayerId,
        });
      } else if (pendingTargetAction?.mode === 'catPair') {
        await sendGameAction({
          type: 'catPair',
          card: pendingTargetAction.card,
          target: targetPlayerId,
        });
        setSelectedCardIds(new Set());
      }
    },
    [targetPickerAction, sendGameAction]
  );

  const handleCancelTarget = useCallback(() => {
    setTargetPickerOpen(false);
    setTargetPickerAction(null);
  }, []);

  const handleConfirmDefuse = useCallback(async () => {
    const deckCount = gameState?.deckCount ?? 0;
    const safeInsert = Math.min(Math.max(0, Number(insertAt) || 0), deckCount);
    await sendGameAction({
      type: 'defuse',
      insertAt: safeInsert,
    });
  }, [gameState?.deckCount, insertAt, sendGameAction]);

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
        case 'reverse':
          return logTemplates.reverse
            ? logTemplates.reverse(actorName)
            : `${actorName} đánh Đảo chiều`;
        case 'shuffle':
          return logTemplates.shuffle ? logTemplates.shuffle(actorName) : `${actorName} đánh Xáo bài`;
        case 'peek':
          return logTemplates.peek ? logTemplates.peek(actorName) : `${actorName} đánh Nhìn trước`;
        case 'favor':
          return logTemplates.favor
            ? logTemplates.favor(actorName, targetName)
            : `${actorName} đánh Nhờ vả`;
        case 'nope':
          return logTemplates.nope
            ? logTemplates.nope(actorName)
            : `${actorName} đánh KHÔNG!`;
        case 'action_cancelled': {
          const cardName = entry.card
            ? strings.cards?.[entry.card] || fallbackCardLabels[entry.card] || entry.card
            : '';
          return logTemplates.action_cancelled
            ? logTemplates.action_cancelled(actorName, cardName)
            : cardName
            ? `Hành động ${cardName} của ${actorName} đã bị chặn bởi KHÔNG!`
            : `Hành động của ${actorName} đã bị chặn bởi KHÔNG!`;
        }
        case 'cat': {
          const cardName = entry.card
            ? strings.cards?.[entry.card] || fallbackCardLabels[entry.card] || entry.card
            : strings.cards?.cat || fallbackCardLabels.cat;
          return logTemplates.cat
            ? logTemplates.cat(actorName, targetName, cardName)
            : targetName
            ? `${actorName} chơi cặp ${cardName} nhắm vào ${targetName}`
            : `${actorName} chơi cặp ${cardName}`;
        }
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
    [strings, mergedGamePlayers, fallbackCardLabels]
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
        (ack?.code ? strings.errors?.[ack.code] : null) ||
        ack?.message ||
        strings.errors?.REMATCH_FAILED ||
        (locale === 'en' ? 'Unable to start rematch' : 'Không thể chơi lại');
      showToast({ code: ack?.code, message: msg }, 'error');
    }
  }, [strings, locale, showToast]);

  // ==========================================================================
  // SCREEN TRANSLATION SHAPES
  // ==========================================================================
  const homeT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      title: isEn ? 'Exploding Kittens' : 'Mèo Nổ',
      subtitle: isEn ? 'Multiplayer survival card game' : 'Game thẻ bài sinh tồn',
      ...strings.home,
      createRoomButton: strings.home?.createRoom || (isEn ? 'Create room' : 'Tạo phòng'),
      orDivider: isEn ? 'or' : 'hoặc',
      joinCodeLabel: strings.home?.roomCodeLabel || (isEn ? 'Room code' : 'Mã phòng'),
      joinCodePlaceholder:
        strings.home?.roomCodePlaceholder || (isEn ? 'Enter 5-character code' : 'Mã 5 ký tự'),
      joinRoomButton: strings.home?.joinRoom || (isEn ? 'Join room' : 'Vào phòng'),
      resumingMessage: strings.home?.rejoining || (isEn ? 'Rejoining room…' : 'Đang vào lại phòng…'),
    };
  }, [strings, locale]);

  const lobbyT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.lobby,
      title: strings.lobby?.title || (isEn ? 'Lobby' : 'Phòng chờ'),
      roomCodeLabel: strings.lobby?.roomCode || (isEn ? 'Room code' : 'Mã phòng'),
      copyCodeButton: strings.lobby?.copy || (isEn ? 'Copy' : 'Sao chép'),
      copyCodeAriaLabel:
        strings.lobby?.copyAriaLabel || (isEn ? 'Copy room code' : 'Sao chép mã phòng'),
      shareCodeButton: strings.lobby?.share || (isEn ? 'Share' : 'Chia sẻ'),
      shareCodeAriaLabel:
        strings.lobby?.shareAriaLabel || (isEn ? 'Share room code' : 'Chia sẻ mã phòng'),
      playerListTitle: strings.lobby?.players || (isEn ? 'Player list' : 'Người chơi'),
      seatLabel: strings.lobby?.seatLabel || (isEn ? 'Seat' : 'Ghế'),
      hostBadge: strings.lobby?.host || (isEn ? 'Host' : 'Chủ phòng'),
      offlineBadge: strings.lobby?.offline || (isEn ? 'Offline' : 'Đang offline'),
      onlineBadge: strings.lobby?.onlineBadge || (isEn ? 'Ready' : 'Sẵn sàng'),
      startButton: strings.lobby?.start || (isEn ? 'Start' : 'Bắt đầu'),
      waitingForHostMessage:
        strings.lobby?.waitingForHost ||
        (isEn ? 'Waiting for host to start' : 'Đang chờ chủ phòng bắt đầu'),
      leaveRoomButton: strings.lobby?.leave || (isEn ? 'Leave room' : 'Rời phòng'),
    };
  }, [strings, locale]);

  const gameOverT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.gameOver,
      gameOverTitle: strings.gameOver?.title || (isEn ? 'Game Over' : 'Kết thúc ván'),
      winnerMessage: strings.gameOver?.winnerLabel || (isEn ? 'Winner' : 'Người chiến thắng'),
      noWinnerMessage: strings.gameOver?.noWinner || (isEn ? 'No winner' : 'Không ai thắng'),
      rematchButton: strings.gameOver?.playAgain || (isEn ? 'Play again' : 'Chơi lại'),
      leaveButton: strings.gameOver?.leaveRoom || (isEn ? 'Leave room' : 'Rời phòng'),
      waitingForRematchMessage:
        strings.gameOver?.waitingForHost ||
        (isEn ? 'Waiting for host to replay' : 'Đang chờ chủ phòng chơi lại'),
    };
  }, [strings, locale]);

  const gameT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.game,
      drawPile: strings.game?.deck || (isEn ? 'Draw pile' : 'Bộ rút'),
      discardPile: strings.game?.discard || (isEn ? 'Discard pile' : 'Bài đã đánh'),
      discardEmpty: strings.game?.discardEmpty || (isEn ? 'Empty' : 'Trống'),
      cardNames: {
        ...fallbackCardLabels,
        ...strings.cards,
      },
      cardRules: isEn ? CARD_RULES_EN : CARD_RULES_VI,
      micOn: strings.voice?.micOn || (isEn ? 'Mic on' : 'Mic bật'),
      micOff: strings.voice?.micOff || (isEn ? 'Turn on mic' : 'Bật mic'),
      muteVoiceFor: strings.voice?.muteVoice,
      unmuteVoiceFor: strings.voice?.unmuteVoice,
      muteChatFor: strings.voice?.muteChat,
      unmuteChatFor: strings.voice?.unmuteChat,
    };
  }, [strings, fallbackCardLabels, locale]);

  const handT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...fallbackCardLabels,
      ...strings.cards,
      hand: strings.game?.yourHand || (isEn ? 'Your hand' : 'Bài trên tay'),
      handAriaLabel:
        strings.game?.handAriaLabel || (isEn ? 'Your hand area' : 'Khu vực bài trên tay'),
      emptyHand:
        strings.game?.emptyHand || (isEn ? 'No cards in hand' : 'Không có lá bài nào trên tay'),
      selected: strings.game?.selected || (isEn ? 'Selected' : 'Đã chọn'),
      unselected: strings.game?.unselected || (isEn ? 'Unselected' : 'Chưa chọn'),
      cardDisabled: strings.game?.cardDisabled || (isEn ? 'Cannot play' : 'Không thể đánh'),
    };
  }, [strings, fallbackCardLabels, locale]);

  const actionBarT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.actions,
      reverse: strings.actions?.reverse || (isEn ? 'Reverse' : 'Đảo chiều'),
      nope: strings.actions?.nope || (isEn ? 'Nope' : 'KHÔNG!'),
      passNope: strings.actions?.passNope || (isEn ? 'Allow' : 'Cho qua'),
      actionBarAriaLabel:
        strings.actions?.actionBarAriaLabel || (isEn ? 'Action bar' : 'Thanh hành động'),
      playSelected:
        strings.actions?.playSelected || (isEn ? 'Play selected' : 'Đánh bài'),
      turnsLeftLabel:
        strings.game?.turnsLeft ||
        (isEn ? (n) => `${n} ${n === 1 ? 'turn' : 'turns'} left` : (n) => `Còn ${n} lượt`),
      countdownLabel:
        strings.actions?.countdown ||
        (isEn ? (s) => `${s}s left` : (s) => `Còn ${s} giây`),
      countdown:
        strings.actions?.countdown ||
        (isEn ? (s) => `${s}s left` : (s) => `Còn ${s} giây`),
    };
  }, [strings, locale]);

  const targetPickerT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.dialog?.targetPicker,
      targetPickerTitle:
        strings.dialog?.targetPicker?.title || (isEn ? 'Choose a target' : 'Chọn mục tiêu'),
      targetPickerPrompt:
        strings.dialog?.targetPicker?.prompt ||
        (isEn ? 'Choose a living player to target:' : 'Chọn một người chơi còn sống để thực hiện:'),
      targetPickerAriaLabel:
        strings.dialog?.targetPicker?.ariaLabel ||
        (isEn ? 'Choose target dialog' : 'Hộp thoại chọn mục tiêu'),
      cancel: strings.dialog?.targetPicker?.cancel || (isEn ? 'Cancel' : 'Hủy'),
      noCandidates:
        strings.dialog?.targetPicker?.noCandidates ||
        (isEn ? 'No eligible players to target' : 'Không có người chơi nào để chọn'),
    };
  }, [strings, locale]);

  const defuseT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...strings.dialog?.defuse,
      defuseTitle: strings.dialog?.defuse?.title || (isEn ? 'Defuse Bomb' : 'Gỡ bom'),
      defusePrompt:
        strings.dialog?.defuse?.prompt ||
        (isEn
          ? 'Choose where to place the Exploding Kitten back into the draw pile:'
          : 'Chọn vị trí đặt lại Mèo Bùm vào bộ rút bài:'),
      defuseAriaLabel:
        strings.dialog?.defuse?.ariaLabel || (isEn ? 'Defuse bomb dialog' : 'Hộp thoại gỡ bom'),
      sliderAriaLabel:
        strings.dialog?.defuse?.sliderAriaLabel ||
        (isEn ? 'Bomb insertion position in draw pile' : 'Vị trí đặt lại bom trong bộ rút'),
      topOfDeck: `${strings.dialog?.defuse?.top || (isEn ? 'Top' : 'Trên cùng')} (0)`,
      bottomOfDeck: (total) =>
        `${strings.dialog?.defuse?.deepest || (isEn ? 'Deepest' : 'Sâu nhất')} (${total})`,
      insertPosition: strings.dialog?.defuse?.insertPosition,
      insertPositionTopDesc: strings.dialog?.defuse?.insertPositionTopDesc,
      insertPositionBottomDesc: strings.dialog?.defuse?.insertPositionBottomDesc,
      insertPositionDesc: strings.dialog?.defuse?.insertPositionDesc,
      placeBomb: strings.dialog?.defuse?.placeBomb || (isEn ? 'Place bomb' : 'Đặt bom'),
    };
  }, [strings, locale]);

  const peekPanelT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      ...fallbackCardLabels,
      ...strings.cards,
      peekTitle:
        strings.peekPanel?.title ||
        (isEn ? 'See the future (top 3 cards)' : 'Nhìn trước (3 lá trên cùng)'),
      peekSubtitle:
        strings.peekPanel?.subtitle ||
        (isEn
          ? 'Left to right (1 = top card → 3):'
          : 'Thứ tự từ trái sang phải (1 → 2 → 3):'),
      peekAriaLabel:
        strings.peekPanel?.title ||
        (isEn ? 'See the future (top 3 cards)' : 'Nhìn trước (3 lá trên cùng)'),
      peekCardTop: strings.peekPanel?.cardTop || (isEn ? '1. Top' : '1. Trên cùng'),
      peekCardMiddle: strings.peekPanel?.cardMiddle || (isEn ? '2. Second' : '2. Ở giữa'),
      peekCardBottom: strings.peekPanel?.cardBottom || (isEn ? '3. Third' : '3. Thứ ba'),
      close: strings.peekPanel?.close || (isEn ? 'Close' : 'Đóng'),
    };
  }, [strings, fallbackCardLabels, locale]);

  const chatT = useMemo(() => {
    const isEn = locale === 'en';
    return {
      chatTitle: strings.chat?.title || (isEn ? 'Chat' : 'Trò chuyện'),
      chatPlaceholder:
        strings.chat?.placeholder || (isEn ? 'Type a message...' : 'Nhập tin nhắn...'),
      chatSendButton: strings.chat?.sendButton || (isEn ? 'Send' : 'Gửi'),
      chatEmpty: strings.chat?.empty || (isEn ? 'No messages yet' : 'Chưa có tin nhắn nào'),
      chatYou: strings.chat?.you || (isEn ? 'You' : 'Bạn'),
      chatInputAriaLabel:
        strings.chat?.inputAriaLabel || (isEn ? 'Message input' : 'Nội dung tin nhắn'),
      chatRegionAriaLabel:
        strings.chat?.regionAriaLabel || (isEn ? 'Chat panel' : 'Hộp trò chuyện'),
      chatListAriaLabel:
        strings.chat?.listAriaLabel || (isEn ? 'Chat messages' : 'Danh sách tin nhắn'),
      chatOpenButtonAriaLabel:
        strings.chat?.openButtonAriaLabel || (isEn ? 'Open chat' : 'Mở hộp trò chuyện'),
      chatCloseButton:
        strings.chat?.closeButton || (isEn ? 'Close chat' : 'Đóng trò chuyện'),
      chatUnreadButtonAriaLabel: strings.chat?.unreadButtonAriaLabel,
      voiceMicOn: strings.voice?.turnMicOff || (isEn ? 'Turn microphone off' : 'Tắt micro'),
      voiceMicOff: strings.voice?.turnMicOn || (isEn ? 'Turn microphone on' : 'Bật micro để nói'),
      voicePlayerControls:
        strings.voice?.playerControlsAriaLabel ||
        (isEn ? 'Per-player voice and chat settings' : 'Tùy chỉnh nghe và xem chat từng người chơi'),
      voiceNoOtherPlayers:
        strings.voice?.noOtherPlayers || (isEn ? 'No other players' : 'Chưa có người chơi khác'),
      voiceMutedShort: strings.voice?.voiceMutedShort || (isEn ? 'Muted' : 'Đã tắt tiếng'),
      voiceUnmutedShort: strings.voice?.voiceUnmutedShort || (isEn ? 'Audio on' : 'Đang nghe'),
      chatMutedShort: strings.voice?.chatMutedShort || (isEn ? 'Chat hidden' : 'Đã ẩn chat'),
      chatUnmutedShort: strings.voice?.chatUnmutedShort || (isEn ? 'Chat shown' : 'Xem chat'),
    };
  }, [strings, locale]);

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
            onOpenThemePicker={() => setThemePickerOpen(true)}
            tableTheme={tableTheme}
            locale={locale}
            onToggleLocale={handleToggleLocale}
          />
        );

      case 'game':
        return (
          <Game
            gameState={gameState}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState?.currentPlayerId}
            turnsLeft={gameState?.turnsLeft}
            direction={gameState?.direction}
            chatBubbles={visibleChatBubbles}
            cardTheme={cardTheme}
            tableTheme={tableTheme}
            locale={locale}
            onToggleLocale={handleToggleLocale}
            onOpenThemePicker={() => setThemePickerOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
            onLeave={handleLeaveRoom}
            micOn={micOn}
            micBusy={micBusy}
            onToggleMic={toggleMic}
            voicePeers={voicePeers}
            mutedVoiceIds={mutedVoiceIds}
            mutedChatIds={mutedChatIds}
            onToggleMuteVoice={handleToggleMuteVoice}
            onToggleMuteChat={handleToggleMuteChat}
            deckCount={gameState?.deckCount ?? 0}
            discardCount={gameState?.discardCount ?? 0}
            discardTop={gameState?.discardTop ?? null}
            players={mergedGamePlayers}
            log={gameState?.log || []}
            toastMessage={toastText}
            toastVariant={toastVariant}
            toastKey={toastKey}
            toastCloseLabel={toastCloseLabel}
            onDismissToast={handleDismissToast}
            renderCard={renderCard}
            renderLogLine={renderLogLine}
            t={gameT}
            actionBarSlot={
              <ActionBar
                t={actionBarT}
                canDraw={canDraw}
                onDraw={handleDrawAction}
                canPlaySelected={selectedPlaySpec.canPlay}
                onPlaySelected={selectedPlaySpec.run}
                playSelectedLabel={selectedPlaySpec.label}
                canSkip={canSkip}
                onSkip={handleSkipAction}
                canAttack={canAttack}
                onAttack={handleAttackAction}
                canReverse={canReverse}
                onReverse={handleReverseAction}
                canFavor={canFavor}
                onFavor={handleFavorAction}
                canCatPair={canCatPair}
                onCatPair={handleCatPairAction}
                canPeek={canPeek}
                onPeek={handlePeekAction}
                canShuffle={canShuffle}
                onShuffle={handleShuffleAction}
                isNopePhase={isNopePhase}
                canNope={canNope}
                onNope={handleNopeAction}
                canPassNope={canPassNope}
                onPassNope={handlePassNopeAction}
                nopePromptText={nopePromptText}
                turnsLeft={gameState?.turnsLeft}
                formatTurnsLeft={strings.game?.turnsLeft}
                turnDeadline={gameState?.phase !== 'over' ? gameState?.turnDeadline : null}
                formatCountdown={actionBarCountdownFormatter}
                beepOnCountdown={isMyTurn || isNopePhase}
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
            <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} locale={locale} />

            {/* Status banners */}
            {isReconnecting && (
              <div
                className="game-status-banner game-status-banner--reconnect"
                role="status"
                aria-live="polite"
              >
                {strings.banners?.reconnecting ||
                  (locale === 'en' ? 'Reconnecting…' : 'Đang kết nối lại…')}
              </div>
            )}
            {myPlayer?.alive === false && (
              <div
                className="game-status-banner game-status-banner--eliminated"
                role="status"
              >
                {strings.banners?.eliminated ||
                  (locale === 'en'
                    ? 'You have been eliminated. You are spectating'
                    : 'Bạn đã bị loại. Bạn đang xem')}
              </div>
            )}
            {otherDefusingName && (
              <div
                className="game-status-banner game-status-banner--defusing"
                role="status"
              >
                {strings.dialog?.defuse?.defusing
                  ? strings.dialog.defuse.defusing(otherDefusingName)
                  : locale === 'en'
                    ? `${otherDefusingName} is defusing…`
                    : `${otherDefusingName} đang gỡ bom…`}
              </div>
            )}

            {/* PeekPanel preview modal (left-to-right 1, 2, 3 for 5s) */}
            {gameState?.peek &&
              Array.isArray(gameState.peek) &&
              dismissedPeekVersion !== gameState.version && (
                <PeekPanel
                  key={`peek-${gameState.version}`}
                  peek={gameState.peek}
                  t={peekPanelT}
                  renderCard={renderCard}
                  durationMs={5000}
                  onClose={() => setDismissedPeekVersion(gameState.version)}
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
              turnDeadline={isDefusing ? gameState?.turnDeadline : null}
              t={defuseT}
            />

            {/* Real-time chat */}
            <Chat
              messages={visibleChatMessages}
              myPlayerId={myPlayerId}
              players={mergedGamePlayers}
              voicePeers={voicePeers}
              mutedVoiceIds={mutedVoiceIds}
              mutedChatIds={mutedChatIds}
              onToggleMuteVoice={handleToggleMuteVoice}
              onToggleMuteChat={handleToggleMuteChat}
              micOn={micOn}
              micBusy={micBusy}
              onToggleMic={toggleMic}
              onSend={handleSendChat}
              t={chatT}
            />

            {/* Card flight animation overlay */}
            <CardFlightLayer flights={cardFlights} renderCard={renderCard} />
          </Game>
        );

      case 'gameOver':
        return (
          <GameOver
            t={gameOverT}
            winnerName={winnerName}
            isHost={isHost}
            tableTheme={tableTheme}
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
            onOpenThemePicker={() => setThemePickerOpen(true)}
            cardTheme={cardTheme}
            tableTheme={tableTheme}
            locale={locale}
            onToggleLocale={handleToggleLocale}
          />
        );
    }
  };

  return (
    <>
      {screen !== 'game' && toastText && (
        <Toast
          message={toastText}
          variant={toastVariant}
          toastKey={toastKey}
          closeLabel={toastCloseLabel}
          onDismiss={handleDismissToast}
        />
      )}
      {renderCurrentScreen()}
      <ThemePicker
        open={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        cardTheme={cardTheme}
        onSelectCardTheme={handleSelectCardTheme}
        tableTheme={tableTheme}
        onSelectTableTheme={handleSelectTableTheme}
        locale={locale}
      />
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
