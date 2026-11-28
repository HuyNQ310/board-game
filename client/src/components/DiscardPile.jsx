import './DiscardPile.css';

export function DiscardPile({ discardCount = 0, discardTop = null, renderCard, t }) {
  const count = Number.isFinite(discardCount) ? discardCount : 0;
  const pileLabel = (t && t.discardPile) ? t.discardPile : 'Bài đã đánh';
  const countText =
    typeof t?.discardCount === 'function' ? t.discardCount(count) : `${count} lá`;
  const emptyText = t?.discardEmpty || 'Trống';

  const cardLabel = (t && t.cardNames && t.cardNames[discardTop])
    ? t.cardNames[discardTop]
    : discardTop;

  const cardRuleText = (t && t.cardRules && t.cardRules[discardTop])
    ? t.cardRules[discardTop]
    : undefined;

  let topCardNode = null;
  if (discardTop != null) {
    if (typeof renderCard === 'function') {
      topCardNode = renderCard({
        type: discardTop,
        faceDown: false,
        label: cardLabel,
        ruleText: cardRuleText,
      });
    } else {
      topCardNode = (
        <div className="discard-pile__card-fallback" data-card-type={discardTop}>
          <div className="discard-pile__card-title">{cardLabel}</div>
          {cardRuleText && (
            <div className="discard-pile__card-rule">{cardRuleText}</div>
          )}
        </div>
      );
    }
  }

  return (
    <div
      className="discard-pile"
      data-testid="discard-pile"
      role="region"
      aria-label={`${pileLabel}: ${countText}`}
    >
      <div className="discard-pile__slot">
        {topCardNode ? (
          <div className="discard-pile__top-wrapper">{topCardNode}</div>
        ) : (
          <div className="discard-pile__empty">
            <span className="discard-pile__empty-text">{emptyText}</span>
          </div>
        )}
      </div>
      <div className="discard-pile__info">
        <div className="discard-pile__label">{pileLabel}</div>
        <div className="discard-pile__count">{countText}</div>
      </div>
    </div>
  );
}

export default DiscardPile;
