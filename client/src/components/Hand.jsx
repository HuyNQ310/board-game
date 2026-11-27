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

import { useState, useRef, useEffect } from 'react';
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

function getPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

const getCardKey = (card, index) => (card && card.id != null ? card.id : `card-${index}`);

export default function Hand({
  cards = [],
  selectedIds,
  onToggleSelect,
  playableIds,
  renderCard,
  t = {},
}) {
  const cardsList = Array.isArray(cards) ? cards : [];
  const cardsCount = cardsList.length;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Track initial deal transition from empty/undefined to populated
  const hasDealtRef = useRef(cardsCount > 0);
  const initialDealtIdsRef = useRef(
    cardsCount > 0 ? new Set(cardsList.map(getCardKey)) : new Set()
  );

  const [isDealing, setIsDealing] = useState(() => {
    return Boolean(cardsCount > 0 && !getPrefersReducedMotion());
  });

  // When cards transition from empty/undefined to populated for the first time
  if (cardsCount > 0 && !hasDealtRef.current) {
    hasDealtRef.current = true;
    initialDealtIdsRef.current = new Set(cardsList.map(getCardKey));
    if (!prefersReducedMotion && !isDealing) {
      setIsDealing(true);
    }
  }

  // End dealing mode if hand size changes from the initial dealt set (draw/play)
  if (isDealing && cardsCount !== initialDealtIdsRef.current.size) {
    setIsDealing(false);
  }

  // Auto-clear dealing state once the staggered entrance animation has completed
  useEffect(() => {
    if (!isDealing) return;
    const durationMs = cardsCount * 80 + 350;
    const timer = setTimeout(() => {
      setIsDealing(false);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isDealing, cardsCount]);

  // Cancel dealing animation immediately if user prefers reduced motion
  useEffect(() => {
    if (prefersReducedMotion && isDealing) {
      setIsDealing(false);
    }
  }, [prefersReducedMotion, isDealing]);

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
          const cardKey = getCardKey(card, index);
          const isCardDealing = isDealing && initialDealtIdsRef.current.has(cardKey);
          const selected = isSelected(card.id);
          const playable = isPlayable(card.id);
          const cardLabel = t[card.type] || DEFAULT_CARD_LABELS[card.type] || card.type;
          const cardIcon = DEFAULT_CARD_ICONS[card.type] || '🎴';

          const handleClick = () => {
            if (playable && typeof onToggleSelect === 'function') {
              onToggleSelect(card.id);
            }
          };

          const slotClasses = [
            'hand-card-slot',
            selected ? 'hand-card-slot--selected' : '',
            !playable ? 'hand-card-slot--disabled' : '',
            isCardDealing ? 'hand-card-slot--dealing' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const slotStyle = isCardDealing
            ? { '--deal-delay': `${index * 80}ms` }
            : undefined;

          return (
            <div
              key={card.id || `card-${index}`}
              className={slotClasses}
              style={slotStyle}
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
