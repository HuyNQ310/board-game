/**
 * DefuseDialog.jsx
 * Modal dialog for choosing the position to re-insert the bomb after defusing.
 *
 * Expected `t` prop keys:
 * - t.defuseTitle: "Gỡ bom thành công!" (Dialog heading)
 * - t.defusePrompt: "Chọn vị trí đặt lại Mèo Bùm vào bộ rút bài:" (Instruction text)
 * - t.defuseAriaLabel: "Hộp thoại gỡ bom" (Accessibility label)
 * - t.sliderAriaLabel: "Vị trí đặt lại bom trong bộ rút" (Slider input aria label)
 * - t.topOfDeck: "Trên cùng" (Slider min label, at index 0)
 * - t.bottomOfDeck: "Sâu nhất" (Slider max label, at index deckCount)
 * - t.insertPosition: "Vị trí: {n} / {total}" (or template function `(insertAt, deckCount) => string`)
 * - t.insertPositionTopDesc: "Lá tiếp theo sẽ rút" (Helpful label when at index 0)
 * - t.insertPositionBottomDesc: "Dưới cùng bộ bài" (Helpful label when at max)
 * - t.insertPositionDesc: "Lá thứ {n} từ trên xuống" (Helpful label for middle positions)
 * - t.placeBomb: "Đặt bom" (Confirm button text)
 *
 * Strict Spec Constraints (rules.md 8.2 & 8.4):
 * - NO close button or dismiss affordance.
 * - Clicking the backdrop does NOT close the dialog.
 * - Pressing Escape does NOT close the dialog (explicitly excluded by rules.md 8.4).
 * - The ONLY way to proceed is by clicking the "Đặt bom" (onConfirm) button.
 */

import { useEffect } from 'react';
import { Scissors, Bomb, Timer } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown.js';
import './DefuseDialog.css';

export default function DefuseDialog({
  open = false,
  deckCount = 0,
  insertAt = 0,
  onInsertAtChange,
  onConfirm,
  turnDeadline = null,
  t = {},
}) {
  const secondsLeft = useCountdown(open ? turnDeadline : null, { beepUnderFive: true });
  // rules.md 8.4 explicitly excludes DefuseDialog from being closed via Escape.
  // Intercept and prevent any default Escape behavior.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  const safeDeckCount = Math.max(0, Number(deckCount) || 0);
  const safeInsertAt = Math.min(Math.max(0, Number(insertAt) || 0), safeDeckCount);

  const getPositionLabel = () => {
    if (typeof t.insertPosition === 'function') {
      return t.insertPosition(safeInsertAt, safeDeckCount);
    }
    if (typeof t.insertPosition === 'string' && t.insertPosition.length > 0) {
      return t.insertPosition
        .replace('{n}', safeInsertAt)
        .replace('{total}', safeDeckCount);
    }
    return `Vị trí: ${safeInsertAt} / ${safeDeckCount}`;
  };

  const getSubDesc = () => {
    if (safeInsertAt === 0) {
      return t.insertPositionTopDesc || 'Lá tiếp theo sẽ rút (trên cùng)';
    }
    if (safeInsertAt === safeDeckCount) {
      return t.insertPositionBottomDesc || 'Dưới cùng bộ bài rút';
    }
    if (typeof t.insertPositionDesc === 'function') {
      return t.insertPositionDesc(safeInsertAt + 1);
    }
    if (typeof t.insertPositionDesc === 'string') {
      return t.insertPositionDesc.replace('{n}', safeInsertAt + 1);
    }
    return `Lá thứ ${safeInsertAt + 1} từ trên xuống`;
  };

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    if (typeof onInsertAtChange === 'function') {
      onInsertAtChange(val);
    }
  };

  const bottomLabel =
    typeof t.bottomOfDeck === 'function'
      ? t.bottomOfDeck(safeDeckCount)
      : t.bottomOfDeck || `Sâu nhất (${safeDeckCount})`;

  return (
    <div
      className="defuse-dialog-backdrop"
      role="presentation"
    >
      <div
        className="defuse-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="defuse-dialog-title"
        aria-describedby="defuse-dialog-desc"
      >
        <header className="defuse-dialog__header">
          <span className="defuse-dialog__icon" aria-hidden="true">
            <Scissors size={20} aria-hidden="true" />
            <Bomb size={20} aria-hidden="true" />
          </span>
          <h2 id="defuse-dialog-title" className="defuse-dialog__title">
            {t.defuseTitle || 'Gỡ bom thành công!'}
          </h2>
          {typeof secondsLeft === 'number' && (
            <span
              className={`defuse-dialog__timer${
                secondsLeft <= 5 ? ' defuse-dialog__timer--urgent' : ''
              }`}
              data-testid="defuse-countdown"
            >
              <Timer size={14} aria-hidden="true" />
              <span>{secondsLeft}s</span>
            </span>
          )}
        </header>

        <p id="defuse-dialog-desc" className="defuse-dialog__prompt">
          {t.defusePrompt || 'Chọn vị trí đặt lại Mèo Bùm vào bộ rút bài:'}
        </p>

        <div className="defuse-dialog__controls">
          <div className="defuse-dialog__slider-wrap">
            <input
              type="range"
              id="defuse-slider"
              className="defuse-dialog__slider"
              min="0"
              max={safeDeckCount}
              value={safeInsertAt}
              onChange={handleSliderChange}
              aria-label={t.sliderAriaLabel || 'Vị trí đặt lại bom trong bộ rút'}
              aria-valuemin="0"
              aria-valuemax={safeDeckCount}
              aria-valuenow={safeInsertAt}
              aria-valuetext={getSubDesc()}
            />
          </div>

          <div className="defuse-dialog__slider-labels" aria-hidden="true">
            <span className="defuse-dialog__slider-label defuse-dialog__slider-label--top">
              {t.topOfDeck || 'Trên cùng (0)'}
            </span>
            <span className="defuse-dialog__slider-label defuse-dialog__slider-label--bottom">
              {bottomLabel}
            </span>
          </div>

          <div className="defuse-dialog__indicator" role="status" aria-live="polite">
            <div className="defuse-dialog__position-val">{getPositionLabel()}</div>
            <div className="defuse-dialog__position-sub">{getSubDesc()}</div>
          </div>
        </div>

        <footer className="defuse-dialog__footer">
          <button
            type="button"
            className="defuse-dialog__confirm-btn"
            onClick={onConfirm}
            aria-label={t.placeBomb || 'Đặt bom'}
          >
            <span className="defuse-dialog__confirm-icon" aria-hidden="true">
              <Bomb size={16} aria-hidden="true" />
            </span>
            <span className="defuse-dialog__confirm-label">{t.placeBomb || 'Đặt bom'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
