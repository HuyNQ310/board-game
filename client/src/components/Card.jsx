import React from 'react';
import './Card.css';
import {
  CARD_COLORS,
  GROUP_ICONS,
  CARD_ILLUSTRATIONS,
  GROUP_SHAPES,
  CardBackPattern,
} from '../assets/cards/icons.jsx';

/**
 * Card Component
 *
 * Implements authoritative visual design from card.md & rules.md.
 *
 * Props:
 * @param {'boom'|'defuse'|'attack'|'skip'|'shuffle'|'favor'|'peek'|'cat'} type - Internal card engine type
 * @param {string} [label] - Translated card display name (e.g. "Mèo Bùm" or "Boom Cat")
 * @param {string} [ruleText] - Translated short rule text (max ~2 lines)
 * @param {boolean} [faceDown=false] - Whether card is shown face down (card back)
 * @param {boolean} [selected=false] - Whether card is currently selected
 * @param {boolean} [disabled=false] - Whether card is disabled/unplayable (dims card per rules.md 8.2)
 * @param {Function} [onClick] - Optional click handler
 * @param {string} [className] - Optional extra class names
 */
export function Card({
  type,
  label = '',
  ruleText = '',
  faceDown = false,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  ...rest
}) {
  const isInteractive = Boolean(onClick) && !disabled;

  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) {
      onClick(e);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e);
    }
  };

  const cardClasses = [
    'card',
    type ? `card--${type}` : '',
    faceDown ? 'card--face-down' : 'card--face-up',
    selected ? 'card--selected' : '',
    disabled ? 'card--disabled' : '',
    isInteractive ? 'card--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Selection badge for multi-modal accessibility (conveys selection via icon + border, not color alone)
  const selectedBadge = selected ? (
    <div className="card__selected-badge" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 8.5 6.5 12 13 4" />
      </svg>
    </div>
  ) : null;

  // Disabled badge for accessibility (icon indicator)
  const disabledBadge = disabled ? (
    <div className="card__disabled-badge" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="4" y1="4" x2="12" y2="12" />
      </svg>
    </div>
  ) : null;

  // Face-down mode: must NEVER reveal type-specific color, icon, or illustration
  if (faceDown) {
    return (
      <div
        className={cardClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={disabled ? -1 : (onClick ? 0 : undefined)}
        aria-label="Card face down"
        aria-selected={selected ? 'true' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        {...rest}
      >
        <div className="card__back">
          <CardBackPattern />
        </div>
        {selectedBadge}
        {disabledBadge}
      </div>
    );
  }

  // Face-up mode
  const stripColor = CARD_COLORS[type] || '#2B2326';
  const shapeName = GROUP_SHAPES[type] || 'shape';
  const GroupIcon = GROUP_ICONS[type];
  const Illustration = CARD_ILLUSTRATIONS[type];

  const accessibleLabel = `${label || type}${ruleText ? `: ${ruleText}` : ''}${
    selected ? ' (selected)' : ''
  }${disabled ? ' (disabled)' : ''}`;

  return (
    <div
      className={cardClasses}
      style={{ '--card-strip-color': stripColor }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={disabled ? -1 : (onClick ? 0 : undefined)}
      aria-label={accessibleLabel}
      aria-selected={selected ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      {...rest}
    >
      {/* 3. Group-icon shape in top-left corner, overlapping the name strip */}
      <div
        className="card__group-icon"
        data-shape={shapeName}
        title={`Group: ${shapeName}`}
        aria-hidden="true"
      >
        {GroupIcon && <GroupIcon size={14} />}
      </div>

      {/* Selected & disabled state badges (top-right corner) */}
      {selectedBadge}
      {disabledBadge}

      {/* 1. Name strip: ~12% height, background = group color, bold white text */}
      <div className="card__name-strip">
        <span className="card__label" title={label || type}>
          {label || type}
        </span>
      </div>

      {/* 2. Illustration area: ~55% height, rounded-corner inner frame */}
      <div className="card__illustration-area">
        <div className="card__illustration-frame">
          {Illustration && <Illustration className="card__illustration-svg" />}
        </div>
      </div>

      {/* 4. Rule box at bottom: cream background, black text, max 2 lines */}
      <div className="card__rule-box">
        <p className="card__rule-text" title={ruleText}>
          {ruleText}
        </p>
      </div>
    </div>
  );
}

export default Card;
