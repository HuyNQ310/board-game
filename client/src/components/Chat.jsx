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
  const [inputText, setInputText] = useState('');
  const messagesContainerRef = useRef(null);

  const safeMessages = Array.isArray(messages) ? messages : [];

  // Auto-scroll directly inside this component's own scroll container.
  // NEVER use scrollIntoView() which scrolls the ancestor document/page.
  useEffect(() => {
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
  }, [safeMessages]);

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

  return (
    <div
      className="chat-panel"
      data-testid="chat-panel"
      role="region"
      aria-label={regionAriaLabel}
    >
      <div className="chat-panel__header">
        <span className="chat-panel__header-icon" aria-hidden="true">💬</span>
        <h3 className="chat-panel__title" data-testid="chat-title">{title}</h3>
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
