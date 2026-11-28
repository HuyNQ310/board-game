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
 *   t.peek: "Mắt Thần", t.cat: "Mèo Vằn", t.reverse: "Đảo Chiều",
 *   t.nope: "KHÔNG!", t.taco: "Mèo Taco", t.potato: "Mèo Khoai Tây"
 *
 * Optional Props:
 * - getDisabledReason: Function `(card) => string | null`. Optional callback to explain
 *   why a specific card is disabled / cannot be played. When provided and a user
 *   clicks or taps an unplayable card, displays a transient, accessible tooltip
 *   with the reason. If omitted, behavior is 100% backward compatible (clicks do nothing).
 *
 * Caller Contract for `onToggleSelect(id)`:
 * - Used for toggling card selection (specifically for building a cat pair play, which requires exactly 2 cards).
 * - This component simply delegates clicks to `onToggleSelect(card.id)` when the card is playable.
 * - The caller is responsible for capping the selection count (e.g. at 2 cards) and validating pair legality.
 */

import { useState, useRef, useEffect } from 'react';
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
  Check,
  AlertTriangle,
} from 'lucide-react';
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
  reverse: 'Đảo Chiều',
  nope: 'KHÔNG!',
  taco: 'Mèo Taco',
  potato: 'Mèo Khoai Tây',
};

const CARD_ICON_COMPONENTS = {
  boom: Bomb,
  defuse: Scissors,
  attack: Swords,
  skip: Moon,
  shuffle: Shuffle,
  favor: HandHeart,
  peek: Eye,
  cat: Cat,
  reverse: RefreshCw,
  nope: Ban,
  taco: Utensils,
  potato: Cookie,
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
  getDisabledReason,
  t = {},
}) {
  const cardsList = Array.isArray(cards) ? cards : [];
  const cardsCount = cardsList.length;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Active disabled reason feedback: { cardKey, reason } | null
  const [disabledFeedback, setDisabledFeedback] = useState(null);

  // Track initial deal transition from empty/undefined to populated
  const hasDealtRef = useRef(cardsCount > 0);
  const initialDealtIdsRef = useRef(
    cardsCount > 0 ? new Set(cardsList.map(getCardKey)) : new Set()
  );
  const prevCardCountsRef = useRef({ count: cardsCount, keys: new Set(cardsList.map(getCardKey)) });
  const [newlyDrawnKey, setNewlyDrawnKey] = useState(null);

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

  // Track single newly drawn card after initial deal so it pops in smoothly as the flight lands
  useEffect(() => {
    const prev = prevCardCountsRef.current;
    const nextKeys = new Set(cardsList.map(getCardKey));
    if (hasDealtRef.current && !isDealing && cardsCount > prev.count && !prefersReducedMotion) {
      const added = cardsList.find((c, idx) => !prev.keys.has(getCardKey(c, idx)));
      if (added) {
        const addedIdx = cardsList.indexOf(added);
        setNewlyDrawnKey(getCardKey(added, addedIdx));
      }
    }
    prevCardCountsRef.current = { count: cardsCount, keys: nextKeys };
  }, [cardsCount, cardsList, isDealing, prefersReducedMotion]);

  useEffect(() => {
    if (!newlyDrawnKey) return undefined;
    const timer = setTimeout(() => setNewlyDrawnKey(null), 450);
    return () => clearTimeout(timer);
  }, [newlyDrawnKey]);

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

  // Auto-dismiss disabled reason popup after 2.5 seconds
  useEffect(() => {
    if (!disabledFeedback) return;
    const timer = setTimeout(() => {
      setDisabledFeedback(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [disabledFeedback]);

  // Dismiss disabled reason on Escape key press
  useEffect(() => {
    if (!disabledFeedback) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDisabledFeedback(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabledFeedback]);

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

  const handleDisabledCardClick = (card, cardKey, e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (typeof getDisabledReason === 'function') {
      const reason = getDisabledReason(card);
      if (reason && typeof reason === 'string' && reason.trim()) {
        setDisabledFeedback({
          cardKey,
          reason: reason.trim(),
        });
      }
    }
  };

  const handLabel = t.handAriaLabel || t.hand || 'Bài trên tay';

  if (!cards || cards.length === 0) {
    return (
      <section className="hand-container" aria-label={handLabel}>
        <div className="hand-empty" role="status">
          <span className="hand-empty__icon" aria-hidden="true">
            <Layers size={20} aria-hidden="true" />
          </span>
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
          const isNewlyDrawn = newlyDrawnKey === cardKey;
          const selected = isSelected(card.id);
          const playable = isPlayable(card.id);
          const cardLabel = t[card.type] || DEFAULT_CARD_LABELS[card.type] || card.type;
          const CardIcon = CARD_ICON_COMPONENTS[card.type] || Layers;

          const isFeedbackActive = Boolean(
            disabledFeedback && disabledFeedback.cardKey === cardKey
          );
          const hasDisabledHandler = !playable && typeof getDisabledReason === 'function';

          const handleClick = () => {
            setDisabledFeedback(null);
            if (playable && typeof onToggleSelect === 'function') {
              onToggleSelect(card.id);
            }
          };

          const slotClasses = [
            'hand-card-slot',
            selected ? 'hand-card-slot--selected' : '',
            !playable ? 'hand-card-slot--disabled' : '',
            hasDisabledHandler ? 'hand-card-slot--can-explain' : '',
            isFeedbackActive ? 'hand-card-slot--has-tooltip' : '',
            isCardDealing ? 'hand-card-slot--dealing' : '',
            isNewlyDrawn ? 'hand-card-slot--drawn' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const slotStyle = isCardDealing
            ? { '--deal-delay': `${index * 85}ms` }
            : undefined;

          return (
            <div
              key={cardKey}
              className={slotClasses}
              style={slotStyle}
              data-card-id={card.id}
              role="listitem"
              onClick={hasDisabledHandler ? (e) => handleDisabledCardClick(card, cardKey, e) : undefined}
              onKeyDown={
                hasDisabledHandler
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDisabledCardClick(card, cardKey, e);
                      }
                    }
                  : undefined
              }
              tabIndex={hasDisabledHandler ? 0 : undefined}
              aria-describedby={isFeedbackActive ? `hand-disabled-tooltip-${cardKey}` : undefined}
            >
              {typeof renderCard === 'function' ? (
                renderCard({
                  id: card.id,
                  type: card.type,
                  faceDown: false,
                  label: cardLabel,
                  selected,
                  disabled: !playable,
                  onClick: playable
                    ? handleClick
                    : (hasDisabledHandler ? (e) => handleDisabledCardClick(card, cardKey, e) : undefined),
                })
              ) : (
                <button
                  type="button"
                  className={`hand-card-fallback ${selected ? 'hand-card-fallback--selected' : ''} ${!playable ? 'hand-card-fallback--disabled' : ''}`}
                  onClick={playable ? handleClick : (hasDisabledHandler ? (e) => handleDisabledCardClick(card, cardKey, e) : handleClick)}
                  disabled={!playable && !getDisabledReason}
                  aria-disabled={!playable ? 'true' : undefined}
                  aria-pressed={selected}
                  aria-label={`${cardLabel}${selected ? ` (${t.selected || 'Đã chọn'})` : ''}${!playable ? ` (${t.cardDisabled || 'Không thể đánh'})` : ''}`}
                >
                  <span className="hand-card-fallback__icon" aria-hidden="true">
                    <CardIcon size={18} aria-hidden="true" />
                  </span>
                  <span className="hand-card-fallback__name">{cardLabel}</span>
                  {selected && (
                    <span className="hand-card-fallback__badge" aria-hidden="true">
                      <Check size={12} aria-hidden="true" /> {t.selected || 'Đã chọn'}
                    </span>
                  )}
                </button>
              )}

              {isFeedbackActive && (
                <div
                  id={`hand-disabled-tooltip-${cardKey}`}
                  className="hand-disabled-tooltip"
                  role="status"
                  aria-live="polite"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDisabledFeedback(null);
                  }}
                >
                  <span className="hand-disabled-tooltip__icon" aria-hidden="true">
                    <AlertTriangle size={15} aria-hidden="true" />
                  </span>
                  <span className="hand-disabled-tooltip__text">{disabledFeedback.reason}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
