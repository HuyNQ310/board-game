/**
 * Chat.jsx
 * Ephemeral real-time chat component for the game room.
 * Pure props-driven presentational component (no socket or store imports).
 *
 * Component API:
 *   Chat({ messages, myPlayerId, onSend, t })
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
 */

import { useState, useRef, useEffect } from 'react';
import './Chat.css';

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

export function Chat({ messages = [], myPlayerId, onSend, t = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const safeMessages = Array.isArray(messages) ? messages : [];
  const [lastSeenCount, setLastSeenCount] = useState(0);

  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Sync lastSeenCount when open or when message list shrinks
  useEffect(() => {
    if (isOpen) {
      setLastSeenCount(safeMessages.length);
    } else if (lastSeenCount > safeMessages.length) {
      setLastSeenCount(safeMessages.length);
    }
  }, [isOpen, safeMessages.length, lastSeenCount]);

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

  // Listen for Escape key to close the chat panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
  }, [safeMessages, isOpen]);

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

  const unreadCount = isOpen ? 0 : Math.max(0, safeMessages.length - lastSeenCount);

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
          setLastSeenCount(safeMessages.length);
          setIsOpen(true);
        }}
        aria-label={getToggleAriaLabel()}
        aria-expanded={false}
      >
        <span className="chat-toggle-icon" aria-hidden="true">💬</span>
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
          <span className="chat-panel__header-icon" aria-hidden="true">💬</span>
          <h3 className="chat-panel__title" data-testid="chat-title">{title}</h3>
        </div>
        <button
          type="button"
          className="chat-panel__close-btn"
          data-testid="chat-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label={closeButtonAriaLabel}
          title={closeButtonAriaLabel}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div
        className="chat-panel__messages"
        data-testid="chat-messages"
        role="log"
        aria-live="polite"
        aria-label={listAriaLabel}
        tabIndex={0}
        ref={messagesContainerRef}
      >
        {safeMessages.length === 0 ? (
          <div className="chat-panel__empty" data-testid="chat-empty">
            {emptyText}
          </div>
        ) : (
          safeMessages.map((msg, index) => {
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
                        👤{' '}
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
          <span className="chat-panel__send-icon" aria-hidden="true">➤</span>
          <span className="chat-panel__send-label">{sendButtonText}</span>
        </button>
      </form>
    </div>
  );
}

export default Chat;
