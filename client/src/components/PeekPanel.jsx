/**
 * PeekPanel.jsx
 * Modal dialog displaying the top 3 cards of the deck left-to-right (1, 2, 3)
 * for 5 seconds to the player who played the "peek" (Mắt Thần) card.
 */

import { useState, useEffect } from 'react';
import {
  Bomb,
  Scissors,
  Swords,
  Moon,
  Shuffle,
  HandHeart,
  Eye,
  Cat,
  RefreshCw,
  Ban,
  Utensils,
  Cookie,
  Layers,
  Timer,
  X,
} from 'lucide-react';
import './PeekPanel.css';

const DEFAULT_CARD_META = {
  boom: { label: 'Mèo Bùm', Icon: Bomb, color: '#c0392b' },
  defuse: { label: 'Kìm Cắt Dây', Icon: Scissors, color: '#16a085' },
  attack: { label: 'Truy Đuổi', Icon: Swords, color: '#d35400' },
  skip: { label: 'Ngủ Trưa', Icon: Moon, color: '#f39c12' },
  shuffle: { label: 'Xáo Trộn', Icon: Shuffle, color: '#27ae60' },
  favor: { label: 'Nài Nỉ', Icon: HandHeart, color: '#e84393' },
  peek: { label: 'Mắt Thần', Icon: Eye, color: '#2980b9' },
  cat: { label: 'Mèo Vằn', Icon: Cat, color: '#8e44ad' },
  reverse: { label: 'Đảo Chiều', Icon: RefreshCw, color: '#1B315E' },
  nope: { label: 'KHÔNG!', Icon: Ban, color: '#B71C1C' },
  taco: { label: 'Mèo Taco', Icon: Utensils, color: '#B86522' },
  potato: { label: 'Mèo Khoai Tây', Icon: Cookie, color: '#7C742B' },
};

const POSITION_KEYS = ['peekCardTop', 'peekCardMiddle', 'peekCardBottom'];
const DEFAULT_POS_LABELS = ['1. Trên cùng', '2. Ở giữa', '3. Thứ ba'];

export default function PeekPanel({
  peek = null,
  t = {},
  renderCard,
  durationMs = 5000,
  onClose,
}) {
  const hasPeek = Array.isArray(peek) && peek.length > 0;
  const totalSeconds = Math.max(1, Math.ceil((Number(durationMs) || 5000) / 1000));

  const [dismissed, setDismissed] = useState(false);
  const [prevPeek, setPrevPeek] = useState(peek);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  if (peek !== prevPeek) {
    setPrevPeek(peek);
    setDismissed(false);
    setSecondsLeft(totalSeconds);
  }

  useEffect(() => {
    if (!hasPeek || dismissed) return undefined;

    const deadline = Date.now() + (Number(durationMs) || 5000);
    setSecondsLeft(Math.max(1, Math.ceil((deadline - Date.now()) / 1000)));

    const intervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft((prev) => (prev === remaining ? prev : remaining));
      if (remaining <= 0) {
        clearInterval(intervalId);
        setDismissed(true);
        if (typeof onClose === 'function') {
          onClose();
        }
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [hasPeek, dismissed, durationMs, onClose, peek]);

  if (!hasPeek || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div
      className="peek-panel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.peekAriaLabel || t.peekTitle || 'Bảng xem trước bài'}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <aside
        className="peek-panel"
        role="region"
        aria-label={t.peekAriaLabel || t.peekTitle || 'Bảng xem trước bài'}
        aria-live="polite"
      >
        <header className="peek-panel__header">
          <div className="peek-panel__header-left">
            <span className="peek-panel__header-icon" aria-hidden="true">
              <Eye size={22} aria-hidden="true" />
            </span>
            <div className="peek-panel__header-text">
              <h3 className="peek-panel__title">{t.peekTitle || 'Nhìn trước 3 lá bài'}</h3>
              <p className="peek-panel__subtitle">
                {t.peekSubtitle || 'Thứ tự từ trái sang phải (1 → 2 → 3):'}
              </p>
            </div>
          </div>

          <div className="peek-panel__header-right">
            <span
              className="peek-panel__timer"
              data-testid="peek-countdown"
              aria-live="off"
            >
              <Timer size={14} aria-hidden="true" />
              <span>{secondsLeft}s</span>
            </span>
            <button
              type="button"
              className="peek-panel__close-btn"
              onClick={handleDismiss}
              aria-label={t.close || 'Đóng'}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <ol className="peek-panel__cards-list" role="list">
          {peek.map((cardItem, index) => {
            const cardType = typeof cardItem === 'string' ? cardItem : (cardItem?.type || 'unknown');
            const meta = DEFAULT_CARD_META[cardType] || { label: cardType, Icon: Layers, color: '#555555' };
            const IconComponent = meta.Icon || Layers;
            const cardLabel = t[cardType] || meta.label;
            const posLabel = t[POSITION_KEYS[index]] || DEFAULT_POS_LABELS[index] || `${index + 1}`;

            return (
              <li
                key={`peek-card-${index}`}
                className="peek-panel__item"
                role="listitem"
              >
                <div className="peek-panel__position-badge">
                  <span className="peek-panel__position-number">{index + 1}</span>
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
                    <div
                      className="peek-panel__fallback-card"
                      style={{ borderLeftColor: meta.color }}
                    >
                      <span className="peek-panel__fallback-icon" aria-hidden="true">
                        <IconComponent size={16} aria-hidden="true" />
                      </span>
                      <span className="peek-panel__fallback-name">{cardLabel}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
