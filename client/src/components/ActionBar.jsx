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
 * - t.reverse: "Đảo chiều"
 * - t.nope: "KHÔNG!"
 * - t.passNope: "Cho qua"
 * - t.turnsLeftLabel: "Còn {n} lượt" (or template function `(n) => string`, or pre-formatted string)
 * - t.countdownLabel: "Còn {n} giây" (or template function `(seconds) => string`, or pre-formatted string; alias: t.countdown)
 *
 * Turns Left Display Support:
 * - When `turnsLeft > 1`, a turns indicator badge is displayed.
 * - String resolution priority:
 *   1. `formatTurnsLeft(turnsLeft)` function prop (if provided).
 *   2. `t.turnsLeftLabel(turnsLeft)` function (if provided as function).
 *   3. `t.turnsLeftLabel` string (replaces `{n}` with `turnsLeft` if present).
 *   4. Fallback string: `"Còn " + turnsLeft + " lượt"`.
 *
 * Turn Countdown Display Support:
 * - When `turnDeadline` is a valid future timestamp (epoch ms), a countdown badge is displayed.
 * - Displays remaining seconds until turn auto-action, updating roughly once per second.
 * - When the countdown reaches zero, it displays "0" (e.g. "Còn 0 giây") until updated by the server.
 * - String resolution priority:
 *   1. `formatCountdown(secondsLeft)` function prop (if provided).
 *   2. `t.countdownLabel(secondsLeft)` or `t.countdown(secondsLeft)` function (if provided as function).
 *   3. `t.countdownLabel` or `t.countdown` string (replaces `{seconds}`, `{s}`, or `{n}` with `secondsLeft` if present).
 *   4. Fallback string: `"Còn " + secondsLeft + " giây"`.
 */

import {
  Zap,
  Timer,
  Layers,
  Play,
  Moon,
  Swords,
  HandHeart,
  Cat,
  Eye,
  Shuffle,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown.js';
import './ActionBar.css';

export default function ActionBar({
  t = {},
  canDraw = false,
  onDraw,
  canPlaySelected = false,
  onPlaySelected,
  playSelectedLabel = null,
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
  canReverse = false,
  onReverse,
  isNopePhase = false,
  canNope = false,
  onNope,
  canPassNope = false,
  onPassNope,
  nopePromptText,
  turnsLeft,
  formatTurnsLeft,
  turnDeadline,
  formatCountdown,
  beepOnCountdown = true,
}) {
  const secondsLeft = useCountdown(turnDeadline, { beepUnderFive: beepOnCountdown });

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

  const getCountdownLabel = (seconds) => {
    if (typeof formatCountdown === 'function') {
      return formatCountdown(seconds);
    }
    const labelT = t.countdownLabel ?? t.countdown ?? t.turnCountdown;
    if (typeof labelT === 'function') {
      return labelT(seconds);
    }
    if (typeof labelT === 'string' && labelT.length > 0) {
      if (labelT.includes('{seconds}')) {
        return labelT.replace('{seconds}', seconds);
      }
      if (labelT.includes('{s}')) {
        return labelT.replace('{s}', seconds);
      }
      if (labelT.includes('{n}')) {
        return labelT.replace('{n}', seconds);
      }
      return labelT;
    }
    return `Còn ${seconds} giây`;
  };

  const showTurnsBadge = typeof turnsLeft === 'number' && turnsLeft > 1;
  const showCountdown = typeof secondsLeft === 'number';

  return (
    <nav
      className="action-bar"
      role="toolbar"
      aria-label={t.actionBarAriaLabel || 'Thanh hành động'}
    >
      {(showTurnsBadge || showCountdown) && (
        <div className="action-bar__status-row">
          {showTurnsBadge && (
            <div className="action-bar__turns-badge" role="status" aria-live="polite">
              <span className="action-bar__turns-icon" aria-hidden="true">
                <Zap size={14} aria-hidden="true" />
              </span>
              <span className="action-bar__turns-text">{getTurnsLeftLabel(turnsLeft)}</span>
            </div>
          )}

          {showCountdown && (
            <div
              className={`action-bar__timer-badge action-bar__countdown${
                secondsLeft <= 5 ? ' action-bar__timer-badge--urgent action-bar__countdown--urgent' : ''
              }`}
              role="status"
              aria-live="polite"
              data-testid="turn-countdown"
            >
              <span className="action-bar__timer-icon action-bar__countdown-icon" aria-hidden="true">
                <Timer size={14} aria-hidden="true" />
              </span>
              <span className="action-bar__timer-text action-bar__countdown-text">
                {getCountdownLabel(secondsLeft)}
              </span>
            </div>
          )}
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
          <span className="action-bar__btn-icon" aria-hidden="true">
            <Layers size={16} aria-hidden="true" />
          </span>
          <span className="action-bar__btn-label">{t.draw || 'Rút bài'}</span>
        </button>

        {/* Contextual "Đánh bài" button mapped to currently selected hand card(s) */}
        {(canPlaySelected || Boolean(playSelectedLabel)) && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--play-selected"
            disabled={!canPlaySelected}
            onClick={onPlaySelected}
            aria-label={playSelectedLabel || t.playSelected || 'Đánh bài'}
            data-testid="play-selected-btn"
          >
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Play size={16} aria-hidden="true" />
            </span>
            <span className="action-bar__btn-label">
              {playSelectedLabel || t.playSelected || 'Đánh bài'}
            </span>
          </button>
        )}

        {/* Skip card action */}
        {canSkip && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--skip"
            onClick={onSkip}
            aria-label={t.skip || 'Bỏ qua'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Moon size={16} aria-hidden="true" />
            </span>
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
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Swords size={16} aria-hidden="true" />
            </span>
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
            <span className="action-bar__btn-icon" aria-hidden="true">
              <HandHeart size={16} aria-hidden="true" />
            </span>
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
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Cat size={16} aria-hidden="true" />
            </span>
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
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Eye size={16} aria-hidden="true" />
            </span>
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
            <span className="action-bar__btn-icon" aria-hidden="true">
              <Shuffle size={16} aria-hidden="true" />
            </span>
            <span className="action-bar__btn-label">{t.shuffle || 'Xáo bài'}</span>
          </button>
        )}

        {/* Reverse card action */}
        {canReverse && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--reverse"
            onClick={onReverse}
            aria-label={t.reverse || 'Đảo chiều'}
          >
            <span className="action-bar__btn-icon" aria-hidden="true">
              <RefreshCw size={16} aria-hidden="true" />
            </span>
            <span className="action-bar__btn-label">{t.reverse || 'Đảo chiều'}</span>
          </button>
        )}
      </div>

      {isNopePhase && (
        <div className="action-bar__nope-row" role="group" aria-label={t.nope || 'KHÔNG!'}>
          {nopePromptText && (
            <span className="action-bar__nope-prompt">{nopePromptText}</span>
          )}
          <div className="action-bar__nope-actions">
            <button
              type="button"
              className="action-bar__btn action-bar__btn--nope"
              disabled={!canNope}
              onClick={onNope}
              aria-label={t.nope || 'KHÔNG!'}
            >
              <span className="action-bar__btn-icon" aria-hidden="true">
                <Ban size={16} aria-hidden="true" />
              </span>
              <span className="action-bar__btn-label">{t.nope || 'KHÔNG!'}</span>
            </button>
            {canPassNope && (
              <button
                type="button"
                className="action-bar__btn action-bar__btn--pass-nope"
                onClick={onPassNope}
                aria-label={t.passNope || 'Cho qua'}
              >
                <span className="action-bar__btn-label">{t.passNope || 'Cho qua'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
