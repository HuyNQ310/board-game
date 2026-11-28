/**
 * Chat.jsx
 * Ephemeral real-time chat component for the game room.
 * Pure props-driven presentational component (no socket or store imports).
 *
 * Component API:
 *   Chat({
 *     messages,
 *     myPlayerId,
 *     onSend,
 *     t,
 *     players,
 *     voicePeers,
 *     mutedVoiceIds,
 *     mutedChatIds,
 *     onToggleMuteVoice,
 *     onToggleMuteChat,
 *     micOn,
 *     micBusy,
 *     onToggleMic,
 *   })
 *
 * Expected `t` prop keys:
 * - t.chatTitle: "Trò chuyện" (Header title)
 * - t.chatPlaceholder: "Nhập tin nhắn..." (Input placeholder text)
 * - t.chatSendButton: "Gửi" (Send button visible text & aria-label)
 * - t.chatEmpty: "Chưa có tin nhắn nào" (Empty state text when messages list is empty)
 * - t.chatYou: "Bạn" (Sender name label for the viewer's own messages)
 * - t.chatInputAriaLabel: "Nội dung tin nhắn" (Accessibility label for the text input)
 * - t.chatRegionAriaLabel: "Hộp trò chuyện" (Accessibility label for the chat region / panel)
 * - t.chatListAriaLabel: "Danh sách tin nhắn" (Accessibility label for the message list log)
 * Optional `t` keys:
 * - t.chatOpenButtonAriaLabel: "Mở hộp trò chuyện" (Accessibility label for toggle button when collapsed with 0 unread)
 * - t.chatCloseButton: "Đóng trò chuyện" (Accessibility label & title for the close/collapse button)
 * - t.chatUnreadButtonAriaLabel: "Trò chuyện ({n} tin nhắn mới)" (Accessibility label template or function for toggle button with unread count)
 * - t.voiceMicOn, t.voiceMicOff, t.voicePlayerControls, t.voiceNoOtherPlayers,
 *   t.voiceMutedShort, t.voiceUnmutedShort, t.chatMutedShort, t.chatUnmutedShort
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  X,
  User,
  Send,
  Mic,
  MicOff,
  Users,
  Volume2,
  VolumeX,
  MessageSquare,
  MessageSquareOff,
} from 'lucide-react';
import './Chat.css';

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);
const MODAL_SELECTOR =
  '[role="dialog"], [role="alertdialog"], .peek-panel-backdrop, .theme-picker-backdrop, .help-modal-backdrop, .target-picker-backdrop, .defuse-dialog-backdrop';

/**
 * Check whether an ID exists in a Set or Array collection.
 *
 * @param {Set<string>|string[]|undefined|null} collection
 * @param {string|undefined|null} id
 * @returns {boolean}
 */
function hasId(collection, id) {
  if (id == null) return false;
  if (collection instanceof Set) return collection.has(id);
  if (Array.isArray(collection)) return collection.includes(id);
  return false;
}

/**
 * Normalize a Set or Array collection of IDs to an array.
 *
 * @param {Set<string>|string[]|undefined|null} collection
 * @returns {string[]}
 */
function toIdArray(collection) {
  if (collection instanceof Set) return Array.from(collection);
  if (Array.isArray(collection)) return collection;
  return [];
}

/**
 * Check whether an element is an interactive control or nested inside a modal/editable region.
 *
 * @param {EventTarget|Element|null} el
 * @returns {boolean}
 */
function isInteractiveOrInModal(el) {
  if (!el || typeof el !== 'object') return false;
  if (typeof el.tagName === 'string' && INTERACTIVE_TAGS.has(el.tagName.toUpperCase())) {
    return true;
  }
  if (el.isContentEditable === true) {
    return true;
  }
  if (typeof el.getAttribute === 'function' && el.getAttribute('contenteditable') === 'true') {
    return true;
  }
  if (typeof el.closest === 'function') {
    if (el.closest('[contenteditable="true"]') || el.closest(MODAL_SELECTOR)) {
      return true;
    }
  }
  return false;
}

/**
 * Format an epoch millisecond timestamp to HH:MM.
 *
 * @param {number} epochMs
 * @returns {string|null}
 */
function formatTime(epochMs) {
  if (!epochMs || typeof epochMs !== 'number') return null;
  try {
    const d = new Date(epochMs);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

export function Chat({
  messages = [],
  myPlayerId,
  onSend,
  t = {},
  players = [],
  voicePeers = {},
  mutedVoiceIds,
  mutedChatIds,
  onToggleMuteVoice,
  onToggleMuteChat,
  micOn = false,
  micBusy = false,
  onToggleMic,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastSeenCount, setLastSeenCount] = useState(0);

  const visibleMessages = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    return safeMessages.filter((msg) => !hasId(mutedChatIds, msg?.playerId));
  }, [messages, mutedChatIds]);

  const otherPlayers = useMemo(() => {
    if (!Array.isArray(players)) return [];
    return players.filter((p) => p && p.id !== myPlayerId);
  }, [players, myPlayerId]);

  const hasMicControl = typeof onToggleMic === 'function';
  const hasVoiceMuteControl = typeof onToggleMuteVoice === 'function';
  const hasChatMuteControl = typeof onToggleMuteChat === 'function';
  const hasPlayerControls = hasVoiceMuteControl || hasChatMuteControl;

  const mutedPlayersCount = useMemo(() => {
    if (otherPlayers.length > 0) {
      return otherPlayers.filter(
        (p) => hasId(mutedVoiceIds, p.id) || hasId(mutedChatIds, p.id)
      ).length;
    }
    const ids = new Set([...toIdArray(mutedVoiceIds), ...toIdArray(mutedChatIds)]);
    if (myPlayerId != null) {
      ids.delete(myPlayerId);
    }
    return ids.size;
  }, [otherPlayers, mutedVoiceIds, mutedChatIds, myPlayerId]);

  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Sync lastSeenCount when open or when visible message list shrinks
  useEffect(() => {
    if (isOpen) {
      setLastSeenCount(visibleMessages.length);
    } else if (lastSeenCount > visibleMessages.length) {
      setLastSeenCount(visibleMessages.length);
    }
  }, [isOpen, visibleMessages.length, lastSeenCount]);

  // Focus management: focus input when opening, return focus to toggle button when closing
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else if (wasOpenRef.current) {
      if (toggleBtnRef.current) {
        toggleBtnRef.current.focus();
      }
    }
  }, [isOpen]);

  // Listen for Enter key to open chat when closed, or Escape key to close when open
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setIsOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    const handleOpenKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (
        e.key !== 'Enter' ||
        e.shiftKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat
      ) {
        return;
      }

      const activeEl = document.activeElement;
      const targetEl = e.target;
      if (isInteractiveOrInModal(activeEl) || isInteractiveOrInModal(targetEl)) {
        return;
      }

      e.preventDefault();
      setLastSeenCount(visibleMessages.length);
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleOpenKeyDown);
    return () => window.removeEventListener('keydown', handleOpenKeyDown);
  }, [isOpen, visibleMessages.length]);

  // Auto-scroll directly inside this component's own scroll container.
  // NEVER use scrollIntoView() which scrolls the ancestor document/page.
  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [visibleMessages, isOpen]);

  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (typeof onSend === 'function') {
      onSend(trimmed);
    }
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const title = t.chatTitle || 'Trò chuyện';
  const placeholder = t.chatPlaceholder || 'Nhập tin nhắn...';
  const sendButtonText = t.chatSendButton || 'Gửi';
  const emptyText = t.chatEmpty || 'Chưa có tin nhắn nào';
  const youText = t.chatYou || 'Bạn';
  const inputAriaLabel = t.chatInputAriaLabel || placeholder;
  const regionAriaLabel = t.chatRegionAriaLabel || title;
  const listAriaLabel = t.chatListAriaLabel || 'Danh sách tin nhắn';
  const closeButtonAriaLabel = t.chatCloseButton || t.chatCloseAriaLabel || 'Đóng trò chuyện';

  const micLabel = micOn ? (t.voiceMicOn || 'Tắt micro') : (t.voiceMicOff || 'Bật micro');
  const playerControlsLabel = t.voicePlayerControls || 'Tùy chỉnh nghe & chat';
  const noOtherPlayersText = t.voiceNoOtherPlayers || 'Chưa có người chơi khác';
  const voiceMutedShort = t.voiceMutedShort || 'Đã tắt tiếng';
  const voiceUnmutedShort = t.voiceUnmutedShort || 'Đang nghe';
  const chatMutedShort = t.chatMutedShort || 'Đã ẩn chat';
  const chatUnmutedShort = t.chatUnmutedShort || 'Xem chat';

  const unreadCount = isOpen ? 0 : Math.max(0, visibleMessages.length - lastSeenCount);

  const getToggleAriaLabel = () => {
    if (unreadCount > 0) {
      if (typeof t.chatUnreadButtonAriaLabel === 'function') {
        return t.chatUnreadButtonAriaLabel(unreadCount);
      }
      if (typeof t.chatUnreadButtonAriaLabel === 'string') {
        return t.chatUnreadButtonAriaLabel.replace('{n}', unreadCount);
      }
      if (typeof t.chatUnreadAriaLabel === 'function') {
        return t.chatUnreadAriaLabel(unreadCount);
      }
      if (typeof t.chatUnreadAriaLabel === 'string') {
        return t.chatUnreadAriaLabel.replace('{n}', unreadCount);
      }
      return `${title} (${unreadCount} tin nhắn mới)`;
    }
    return t.chatOpenButtonAriaLabel || t.chatOpenAriaLabel || 'Mở hộp trò chuyện';
  };

  if (!isOpen) {
    return (
      <button
        ref={toggleBtnRef}
        type="button"
        className="chat-toggle-btn"
        data-testid="chat-toggle-btn"
        onClick={() => {
          setLastSeenCount(visibleMessages.length);
          setIsOpen(true);
        }}
        aria-label={getToggleAriaLabel()}
        aria-expanded={false}
      >
        <span className="chat-toggle-icon" aria-hidden="true">
          <MessageCircle size={18} aria-hidden="true" />
        </span>
        {unreadCount > 0 && (
          <span className="chat-unread-badge" data-testid="chat-unread-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="chat-panel"
      data-testid="chat-panel"
      role="region"
      aria-label={regionAriaLabel}
    >
      <div className="chat-panel__header">
        <div className="chat-panel__header-title-group">
          <span className="chat-panel__header-icon" aria-hidden="true">
            <MessageCircle size={18} aria-hidden="true" />
          </span>
          <h3 className="chat-panel__title" data-testid="chat-title">{title}</h3>
        </div>
        <div className="chat-panel__header-actions">
          {hasMicControl && (
            <button
              type="button"
              className={`chat-panel__header-btn chat-panel__mic-btn${micOn ? ' is-active' : ''}`}
              data-testid="chat-mic-toggle-btn"
              onClick={onToggleMic}
              aria-pressed={Boolean(micOn)}
              disabled={Boolean(micBusy)}
              aria-label={micLabel}
              title={micLabel}
            >
              <span aria-hidden="true">
                {micOn ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
              </span>
            </button>
          )}
          {hasPlayerControls && (
            <button
              type="button"
              className={`chat-panel__header-btn chat-panel__filters-btn${showPlayerControls ? ' is-active' : ''}`}
              data-testid="chat-player-filters-btn"
              onClick={() => setShowPlayerControls((prev) => !prev)}
              aria-expanded={showPlayerControls}
              aria-controls="chat-player-filters-drawer"
              aria-label={
                mutedPlayersCount > 0
                  ? `${playerControlsLabel} (${mutedPlayersCount})`
                  : playerControlsLabel
              }
              title={playerControlsLabel}
            >
              <span aria-hidden="true">
                <Users size={18} aria-hidden="true" />
              </span>
              {mutedPlayersCount > 0 && (
                <span
                  className="chat-panel__filter-badge"
                  data-testid="chat-player-filters-badge"
                  aria-hidden="true"
                >
                  {mutedPlayersCount > 99 ? '99+' : mutedPlayersCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            className="chat-panel__close-btn"
            data-testid="chat-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label={closeButtonAriaLabel}
            title={closeButtonAriaLabel}
          >
            <span aria-hidden="true">
              <X size={18} aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {hasPlayerControls && showPlayerControls && (
        <div
          id="chat-player-filters-drawer"
          className="chat-player-filters"
          data-testid="chat-player-filters"
          role="region"
          aria-label={playerControlsLabel}
        >
          <div className="chat-player-filters__heading">{playerControlsLabel}</div>
          {otherPlayers.length === 0 ? (
            <div className="chat-player-filters__empty" data-testid="chat-player-filters-empty">
              {noOtherPlayersText}
            </div>
          ) : (
            <ul className="chat-player-filters__list">
              {otherPlayers.map((player) => {
                const isVoiceMuted = hasId(mutedVoiceIds, player.id);
                const isChatMuted = hasId(mutedChatIds, player.id);
                const peerState = voicePeers && player.id != null ? voicePeers[player.id] : undefined;
                const isSpeaking = Boolean(peerState?.speaking && !isVoiceMuted);
                const isPeerMicOn = Boolean(peerState?.micOn);
                const playerName = player.name || 'Người chơi';
                const voiceText = isVoiceMuted ? voiceMutedShort : voiceUnmutedShort;
                const chatText = isChatMuted ? chatMutedShort : chatUnmutedShort;

                return (
                  <li
                    key={player.id}
                    className={`chat-player-row${player.connected === false ? ' is-offline' : ''}`}
                    data-testid={`chat-player-row-${player.id}`}
                  >
                    <div className="chat-player-row__identity">
                      {isSpeaking && (
                        <span
                          className="chat-player-row__speaking"
                          data-testid={`chat-player-speaking-${player.id}`}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`chat-player-row__mic-icon${isPeerMicOn ? ' is-mic-on' : ''}`}
                        aria-hidden="true"
                      >
                        {isPeerMicOn ? (
                          <Mic size={13} aria-hidden="true" />
                        ) : (
                          <MicOff size={13} aria-hidden="true" />
                        )}
                      </span>
                      <span className="chat-player-row__name" title={playerName}>
                        {playerName}
                      </span>
                    </div>
                    <div className="chat-player-row__actions">
                      {hasVoiceMuteControl && (
                        <button
                          type="button"
                          className={`chat-player-row__btn${isVoiceMuted ? ' is-muted' : ''}`}
                          data-testid={`chat-filter-voice-${player.id}`}
                          aria-pressed={isVoiceMuted}
                          aria-label={`${playerName}: ${voiceText}`}
                          onClick={() => onToggleMuteVoice(player.id)}
                        >
                          <span aria-hidden="true">
                            {isVoiceMuted ? (
                              <VolumeX size={14} aria-hidden="true" />
                            ) : (
                              <Volume2 size={14} aria-hidden="true" />
                            )}
                          </span>
                          <span>{voiceText}</span>
                        </button>
                      )}
                      {hasChatMuteControl && (
                        <button
                          type="button"
                          className={`chat-player-row__btn${isChatMuted ? ' is-muted' : ''}`}
                          data-testid={`chat-filter-chat-${player.id}`}
                          aria-pressed={isChatMuted}
                          aria-label={`${playerName}: ${chatText}`}
                          onClick={() => onToggleMuteChat(player.id)}
                        >
                          <span aria-hidden="true">
                            {isChatMuted ? (
                              <MessageSquareOff size={14} aria-hidden="true" />
                            ) : (
                              <MessageSquare size={14} aria-hidden="true" />
                            )}
                          </span>
                          <span>{chatText}</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div
        className="chat-panel__messages"
        data-testid="chat-messages"
        role="log"
        aria-live="polite"
        aria-label={listAriaLabel}
        tabIndex={0}
        ref={messagesContainerRef}
      >
        {visibleMessages.length === 0 ? (
          <div className="chat-panel__empty" data-testid="chat-empty">
            {emptyText}
          </div>
        ) : (
          visibleMessages.map((msg, index) => {
            const isSelf = myPlayerId != null && msg.playerId === myPlayerId;
            const authorName = isSelf ? youText : (msg.name || 'Người chơi');
            const timeFormatted = formatTime(msg.at);
            const key = msg.id || `${msg.playerId || 'player'}-${msg.at || index}-${index}`;

            return (
              <div
                key={key}
                className={`chat-message ${isSelf ? 'chat-message--self' : 'chat-message--other'}`}
                data-testid={`chat-message-${index}`}
              >
                <div className="chat-message__meta">
                  <span className="chat-message__author">
                    {isSelf && (
                      <span className="chat-message__self-icon" aria-hidden="true">
                        <User size={13} aria-hidden="true" />
                      </span>
                    )}
                    {authorName}
                  </span>
                  {timeFormatted && (
                    <time
                      className="chat-message__time"
                      dateTime={typeof msg.at === 'number' ? new Date(msg.at).toISOString() : undefined}
                    >
                      {timeFormatted}
                    </time>
                  )}
                </div>
                <div className="chat-message__bubble">
                  <p className="chat-message__text">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="chat-panel__form" onSubmit={handleSubmit} data-testid="chat-form">
        <input
          ref={inputRef}
          type="text"
          className="chat-panel__input"
          data-testid="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={500}
          aria-label={inputAriaLabel}
        />
        <button
          type="submit"
          className="chat-panel__send-btn"
          data-testid="chat-send-btn"
          disabled={!inputText.trim()}
          aria-label={sendButtonText}
        >
          <span className="chat-panel__send-icon" aria-hidden="true">
            <Send size={16} aria-hidden="true" />
          </span>
          <span className="chat-panel__send-label">{sendButtonText}</span>
        </button>
      </form>
    </div>
  );
}

export default Chat;
