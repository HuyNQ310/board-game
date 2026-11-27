/**
 * Hand.jsx
 * Displays the current player's hand cards in a horizontal scrollable strip.
 *
 * Expected `t` prop keys:
 * - t.hand: "Bài trên tay" (Hand section title or label)
 * - t.handAriaLabel: "Khu vực bài trên tay" (Accessibility label for the hand region)
 * - t.emptyHand: "Không có lá bài nào trên tay" (Empty state text)
 * - t.selected: "Đã chọn" (Accessibility status for selected card)
 * - t.unselected: "Chưa chọn" (Accessibility status for unselected card)
 * - t.cardDisabled: "Không thể đánh" (Status for unplayable card)
 * - Fallback card names:
 *   t.boom: "Mèo Bùm", t.defuse: "Kìm Cắt Dây", t.attack: "Truy Đuổi",
 *   t.skip: "Ngủ Trưa", t.shuffle: "Xáo Trộn", t.favor: "Nài Nỉ",
 *   t.peek: "Mắt Thần", t.cat: "Mèo Vằn"
 *
 * Caller Contract for `onToggleSelect(id)`:
 * - Used for toggling card selection (specifically for building a cat pair play, which requires exactly 2 cards).
 * - This component simply delegates clicks to `onToggleSelect(card.id)` when the card is playable.
 * - The caller is responsible for capping the selection count (e.g. at 2 cards) and validating pair legality.
 */

import React from 'react';
import './Hand.css';

const DEFAULT_CARD_LABELS = {
  boom: 'Mèo Bùm',
  defuse: 'Kìm Cắt Dây',
  attack: 'Truy Đuổi',
  skip: 'Ngủ Trưa',
  shuffle: 'Xáo Trộn',
  favor: 'Nài Nỉ',
  peek: 'Mắt Thần',
  cat: 'Mèo Vằn',
};

const DEFAULT_CARD_ICONS = {
  boom: '💣',
  defuse: '✂️',
  attack: '⚔️',
  skip: '💤',
  shuffle: '🔀',
  favor: '🤲',
  peek: '👁️',
  cat: '🐱',
};

export default function Hand({
  cards = [],
  selectedIds,
  onToggleSelect,
  playableIds,
  renderCard,
  t = {},
}) {
  const isSelected = (id) => {
    if (!selectedIds) return false;
    if (selectedIds instanceof Set) return selectedIds.has(id);
    if (Array.isArray(selectedIds)) return selectedIds.includes(id);
    return false;
  };

  const isPlayable = (id) => {
    if (playableIds == null) return true;
    if (playableIds instanceof Set) return playableIds.has(id);
    if (Array.isArray(playableIds)) return playableIds.includes(id);
    return Boolean(playableIds[id]);
  };

  const handLabel = t.handAriaLabel || t.hand || 'Bài trên tay';

  if (!cards || cards.length === 0) {
    return (
      <section className="hand-container" aria-label={handLabel}>
        <div className="hand-empty" role="status">
          <span className="hand-empty__icon" aria-hidden="true">🃏</span>
          <span className="hand-empty__text">{t.emptyHand || 'Không có lá bài nào trên tay'}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="hand-container" aria-label={handLabel}>
      <div className="hand-scroll-strip" role="list">
        {cards.map((card, index) => {
          const selected = isSelected(card.id);
          const playable = isPlayable(card.id);
          const cardLabel = t[card.type] || DEFAULT_CARD_LABELS[card.type] || card.type;
          const cardIcon = DEFAULT_CARD_ICONS[card.type] || '🎴';

          const handleClick = () => {
            if (playable && typeof onToggleSelect === 'function') {
              onToggleSelect(card.id);
            }
          };

          return (
            <div
              key={card.id || `card-${index}`}
              className={`hand-card-slot ${selected ? 'hand-card-slot--selected' : ''} ${!playable ? 'hand-card-slot--disabled' : ''}`}
              role="listitem"
            >
              {typeof renderCard === 'function' ? (
                renderCard({
                  id: card.id,
                  type: card.type,
                  faceDown: false,
                  label: cardLabel,
                  selected,
                  disabled: !playable,
                  onClick: playable ? handleClick : undefined,
                })
              ) : (
                <button
                  type="button"
                  className={`hand-card-fallback ${selected ? 'hand-card-fallback--selected' : ''} ${!playable ? 'hand-card-fallback--disabled' : ''}`}
                  onClick={handleClick}
                  disabled={!playable}
                  aria-pressed={selected}
                  aria-label={`${cardLabel}${selected ? ` (${t.selected || 'Đã chọn'})` : ''}${!playable ? ` (${t.cardDisabled || 'Không thể đánh'})` : ''}`}
                >
                  <span className="hand-card-fallback__icon" aria-hidden="true">{cardIcon}</span>
                  <span className="hand-card-fallback__name">{cardLabel}</span>
                  {selected && (
                    <span className="hand-card-fallback__badge" aria-hidden="true">
                      ✓ {t.selected || 'Đã chọn'}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
