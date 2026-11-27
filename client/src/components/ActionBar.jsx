/**
 * ActionBar.jsx
 * Action bar presenting the available game action buttons for the current player.
 *
 * Expected `t` prop keys:
 * - t.actionBarAriaLabel: "Thanh hành động" (Accessibility label for the toolbar)
 * - t.draw: "Rút bài"
 * - t.skip: "Bỏ qua"
 * - t.attack: "Tấn công"
 * - t.favor: "Nhờ vả"
 * - t.catPair: "Chơi cặp mèo"
 * - t.peek: "Nhìn trước"
 * - t.shuffle: "Xáo bài"
 * - t.turnsLeftLabel: "Còn {n} lượt" (or template function `(n) => string`, or pre-formatted string)
 *
 * Turns Left Display Support:
 * - When `turnsLeft > 1`, a turns indicator badge is displayed.
 * - String resolution priority:
 *   1. `formatTurnsLeft(turnsLeft)` function prop (if provided).
 *   2. `t.turnsLeftLabel(turnsLeft)` function (if provided as function).
 *   3. `t.turnsLeftLabel` string (replaces `{n}` with `turnsLeft` if present).
 *   4. Fallback string: `"Còn " + turnsLeft + " lượt"`.
 */

import React from 'react';
import './ActionBar.css';

export default function ActionBar({
  t = {},
  canDraw = false,
  onDraw,
  canSkip = false,
  onSkip,
  canAttack = false,
  onAttack,
  canFavor = false,
  onFavor,
  canCatPair = false,
  onCatPair,
  canPeek = false,
  onPeek,
  canShuffle = false,
  onShuffle,
  turnsLeft,
  formatTurnsLeft,
}) {
  const getTurnsLeftLabel = (n) => {
    if (typeof formatTurnsLeft === 'function') {
      return formatTurnsLeft(n);
    }
    if (typeof t.turnsLeftLabel === 'function') {
      return t.turnsLeftLabel(n);
    }
    if (typeof t.turnsLeftLabel === 'string' && t.turnsLeftLabel.length > 0) {
      return t.turnsLeftLabel.includes('{n}')
        ? t.turnsLeftLabel.replace('{n}', n)
        : t.turnsLeftLabel;
    }
    return `Còn ${n} lượt`;
  };

  const showTurnsBadge = typeof turnsLeft === 'number' && turnsLeft > 1;

  return (
    <nav
      className="action-bar"
      role="toolbar"
      aria-label={t.actionBarAriaLabel || 'Thanh hành động'}
    >
      {showTurnsBadge && (
        <div className="action-bar__turns-badge" role="status" aria-live="polite">
          <span className="action-bar__turns-icon" aria-hidden="true">⚡</span>
          <span className="action-bar__turns-text">{getTurnsLeftLabel(turnsLeft)}</span>
        </div>
      )}

      <div className="action-bar__buttons">
        {/* "Rút bài" is prominent, enabled only when canDraw is true */}
        <button
          type="button"
          className="action-bar__btn action-bar__btn--draw"
          disabled={!canDraw}
          onClick={onDraw}
          aria-label={t.draw || 'Rút bài'}
        >
          <span className="action-bar__btn-icon" aria-hidden="true">🃏</span>
          <span className="action-bar__btn-label">{t.draw || 'Rút bài'}</span>
        </button>

        {/* Skip card action */}
        {canSkip && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--skip"
            onClick={onSkip}
            aria-label={t.skip || 'Bỏ qua'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">💤</span>
            <span className="action-bar__btn-label">{t.skip || 'Bỏ qua'}</span>
          </button>
        )}

        {/* Attack card action */}
        {canAttack && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--attack"
            onClick={onAttack}
            aria-label={t.attack || 'Tấn công'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">⚔️</span>
            <span className="action-bar__btn-label">{t.attack || 'Tấn công'}</span>
          </button>
        )}

        {/* Favor card action */}
        {canFavor && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--favor"
            onClick={onFavor}
            aria-label={t.favor || 'Nhờ vả'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">🤲</span>
            <span className="action-bar__btn-label">{t.favor || 'Nhờ vả'}</span>
          </button>
        )}

        {/* Cat pair action (requires 2 cat cards selected) */}
        {canCatPair && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--cat-pair"
            onClick={onCatPair}
            aria-label={t.catPair || 'Chơi cặp mèo'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">🐱🐱</span>
            <span className="action-bar__btn-label">{t.catPair || 'Chơi cặp mèo'}</span>
          </button>
        )}

        {/* Peek card action (See 3 cards ahead) */}
        {canPeek && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--peek"
            onClick={onPeek}
            aria-label={t.peek || 'Nhìn trước'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">👁️</span>
            <span className="action-bar__btn-label">{t.peek || 'Nhìn trước'}</span>
          </button>
        )}

        {/* Shuffle card action */}
        {canShuffle && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--shuffle"
            onClick={onShuffle}
            aria-label={t.shuffle || 'Xáo bài'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">🔀</span>
            <span className="action-bar__btn-label">{t.shuffle || 'Xáo bài'}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
