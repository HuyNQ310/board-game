import { PawPrint } from 'lucide-react';
import './DrawPile.css';

export function DrawPile({ deckCount = 0, t }) {
  const count = Number.isFinite(deckCount) ? deckCount : 0;
  const pileLabel = (t && t.drawPile) ? t.drawPile : 'Bộ rút';
  const countText =
    typeof t?.deckCount === 'function' ? t.deckCount(count) : `${count} lá`;

  return (
    <div
      className="draw-pile"
      data-testid="draw-pile"
      role="region"
      aria-label={`${pileLabel}: ${countText}`}
    >
      <div className="draw-pile__card" aria-hidden="true">
        <div className="draw-pile__pattern" />
        <div className="draw-pile__card-center">
          <span className="draw-pile__icon">
            <PawPrint size={22} aria-hidden="true" />
          </span>
          <span className="draw-pile__badge">{count}</span>
        </div>
      </div>
      <div className="draw-pile__info">
        <div className="draw-pile__label">{pileLabel}</div>
        <div className="draw-pile__count">{countText}</div>
      </div>
    </div>
  );
}

export default DrawPile;
