/**
 * PeekPanel.jsx
 * Modal dialog displaying the top 3 cards of the deck vertically (top-to-
 * bottom) to the player who played the "peek" (Mắt Thần) card.
 *
 * Expected `t` prop keys:
 * - t.peekTitle: "Nhìn trước 3 lá bài" (Panel title)
 * - t.peekSubtitle: "Thứ tự từ trên xuống dưới của bộ rút:" (Description)
 * - t.peekAriaLabel: "Bảng xem trước bài" (Accessibility region label)
 * - t.peekCardTop: "1. Trên cùng" (Position 1 label)
 * - t.peekCardMiddle: "2. Ở giữa" (Position 2 label)
 * - t.peekCardBottom: "3. Thứ ba" (Position 3 label)
 * - t.close: "Đóng" (Close button label)
 * - Fallback card names:
 *   t.boom, t.defuse, t.attack, t.skip, t.shuffle, t.favor, t.peek, t.cat
 *
 * Rules Spec (rules.md 8.2):
 * - When `peek` is not null: render 3 cards top-to-bottom, as a modal dialog
 *   (consistent with TargetPicker's modal treatment elsewhere in the app).
 * - When `peek` is null: render nothing.
 * - Only ever shown to the player who peeked.
 *
 * Shared turn clock (owner request): peeking does NOT pause or grant extra
 * time -- the dialog shows the SAME countdown as the turn timer
 * (`turnDeadline`, epoch ms) so the player can see they're still on the
 * clock while looking, instead of the dialog implying unlimited time.
 * Closable via the close button, Escape, or clicking the backdrop -- closing
 * is a local UI dismissal only; the server already clears `peek` on this
 * player's next action regardless.
 */

import { useEffect, useState } from 'react';
import './PeekPanel.css';

const DEFAULT_CARD_META = {
  boom: { label: 'Mèo Bùm', icon: '💣', color: '#c0392b' },
  defuse: { label: 'Kìm Cắt Dây', icon: '✂️', color: '#16a085' },
  attack: { label: 'Truy Đuổi', icon: '⚔️', color: '#d35400' },
  skip: { label: 'Ngủ Trưa', icon: '💤', color: '#f39c12' },
  shuffle: { label: 'Xáo Trộn', icon: '🔀', color: '#27ae60' },
  favor: { label: 'Nài Nỉ', icon: '🤲', color: '#e84393' },
  peek: { label: 'Mắt Thần', icon: '👁️', color: '#2980b9' },
  cat: { label: 'Mèo Vằn', icon: '🐱', color: '#8e44ad' },
};

const POSITION_KEYS = ['peekCardTop', 'peekCardMiddle', 'peekCardBottom'];
const DEFAULT_POS_LABELS = ['1. Trên cùng', '2. Ở giữa', '3. Thứ ba'];

function useCountdown(turnDeadline) {
  const [prevTurnDeadline, setPrevTurnDeadline] = useState(turnDeadline);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (typeof turnDeadline === 'number' && !Number.isNaN(turnDeadline) && turnDeadline > Date.now()) {
      return Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
    }
    return null;
  });

  if (turnDeadline !== prevTurnDeadline) {
    setPrevTurnDeadline(turnDeadline);
    if (typeof turnDeadline === 'number' && !Number.isNaN(turnDeadline) && turnDeadline > Date.now()) {
      setSecondsLeft(Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000)));
    } else {
      setSecondsLeft(null);
    }
  }

  useEffect(() => {
    if (typeof turnDeadline !== 'number' || Number.isNaN(turnDeadline) || turnDeadline <= Date.now()) {
      setSecondsLeft(null);
      return;
    }
    const computeRemaining = () => Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
    setSecondsLeft(computeRemaining());
    const intervalId = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(intervalId);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [turnDeadline]);

  return secondsLeft;
}

export default function PeekPanel({
  peek = null,
  turnDeadline,
  onClose,
  t = {},
  renderCard,
}) {
  const open = Boolean(peek && Array.isArray(peek) && peek.length > 0);
  const secondsLeft = useCountdown(turnDeadline);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onClose === 'function') onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof onClose === 'function') {
      onClose();
    }
  };

  const hasCountdown = typeof secondsLeft === 'number';
  const isUrgent = hasCountdown && secondsLeft <= 5;

  return (
    <div className="peek-panel-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        className="peek-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="peek-panel-title"
        aria-label={t.peekAriaLabel || t.peekTitle || 'Bảng xem trước bài'}
      >
        <header className="peek-panel__header">
          <span className="peek-panel__header-icon" aria-hidden="true">👁️</span>
          <div className="peek-panel__header-text">
            <h3 id="peek-panel-title" className="peek-panel__title">{t.peekTitle || 'Nhìn trước 3 lá bài'}</h3>
            <p className="peek-panel__subtitle">
              {t.peekSubtitle || 'Thứ tự từ trên xuống dưới của bộ rút:'}
            </p>
          </div>
        </header>

        {hasCountdown && (
          <div
            className={`peek-panel__timer${isUrgent ? ' peek-panel__timer--urgent' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">⏱️</span>
            <span>Lượt vẫn đang chạy — còn {secondsLeft} giây</span>
          </div>
        )}

        <ol className="peek-panel__cards-list" role="list">
          {peek.map((cardItem, index) => {
            const cardType = typeof cardItem === 'string' ? cardItem : (cardItem?.type || 'unknown');
            const meta = DEFAULT_CARD_META[cardType] || { label: cardType, icon: '🎴', color: '#555555' };
            const cardLabel = t[cardType] || meta.label;
            const posLabel = t[POSITION_KEYS[index]] || DEFAULT_POS_LABELS[index] || `${index + 1}`;

            return (
              <li key={`peek-card-${index}`} className="peek-panel__item" role="listitem">
                <div className="peek-panel__position-badge" aria-hidden="true">
                  <span className="peek-panel__position-dot" style={{ backgroundColor: meta.color }} />
                  <span className="peek-panel__position-text">{posLabel}</span>
                </div>

                <div className="peek-panel__card-content">
                  {typeof renderCard === 'function' ? (
                    renderCard({
                      type: cardType,
                      faceDown: false,
                      label: cardLabel,
                      selected: false,
                      disabled: false,
                    })
                  ) : (
                    <div className="peek-panel__fallback-card" style={{ borderLeftColor: meta.color }}>
                      <span className="peek-panel__fallback-icon" aria-hidden="true">{meta.icon}</span>
                      <span className="peek-panel__fallback-name">{cardLabel}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <footer className="peek-panel__footer">
          <button
            type="button"
            className="peek-panel__close-btn"
            onClick={onClose}
            aria-label={t.close || 'Đóng'}
          >
            {t.close || 'Đóng'}
          </button>
        </footer>
      </div>
    </div>
  );
}
