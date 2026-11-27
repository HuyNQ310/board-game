import React from 'react';
import './DrawPile.css';

export function DrawPile({ deckCount = 0, t }) {
  const count = Number.isFinite(deckCount) ? deckCount : 0;
  const pileLabel = (t && t.drawPile) ? t.drawPile : 'Bộ rút';

  return (
    <div
      className="draw-pile"
      data-testid="draw-pile"
      role="region"
      aria-label={`${pileLabel}: ${count} lá`}
    >
      <div className="draw-pile__card" aria-hidden="true">
        <div className="draw-pile__pattern" />
        <div className="draw-pile__card-center">
          <span className="draw-pile__icon">🐾</span>
          <span className="draw-pile__badge">{count}</span>
        </div>
      </div>
      <div className="draw-pile__info">
        <div className="draw-pile__label">{pileLabel}</div>
        <div className="draw-pile__count">{count} lá</div>
      </div>
    </div>
  );
}

export default DrawPile;
