/**
 * CardFlightLayer.jsx
 * Fixed-position GPU-accelerated card flight overlay for:
 * - Dealing initial cards from the draw pile into the player's hand & opponent seats
 * - Drawing cards from the draw pile into the hand / opponent seat
 * - Playing cards from hand / opponent seat onto the discard pile
 */

import './CardFlightLayer.css';

export default function CardFlightLayer({ flights = [], renderCard }) {
  if (!Array.isArray(flights) || flights.length === 0) {
    return null;
  }

  return (
    <div className="card-flight-layer" aria-hidden="true">
      {flights.map((flight) => {
        const {
          id,
          fromX,
          fromY,
          fromW,
          fromH,
          dx,
          dy,
          scaleEnd = 1,
          rotateStart = 0,
          rotateEnd = 0,
          delayMs = 0,
          durationMs = 380,
          faceDown = true,
          cardType = 'cat',
          cardLabel = '',
          cardRuleText = '',
          variant = 'draw',
        } = flight;

        const style = {
          left: `${fromX}px`,
          top: `${fromY}px`,
          width: `${fromW}px`,
          height: `${fromH}px`,
          '--flight-dx': `${dx}px`,
          '--flight-dy': `${dy}px`,
          '--flight-scale-end': String(scaleEnd),
          '--flight-rot-start': `${rotateStart}deg`,
          '--flight-rot-end': `${rotateEnd}deg`,
          '--flight-delay': `${delayMs}ms`,
          '--flight-duration': `${durationMs}ms`,
        };

        return (
          <div
            key={id}
            className={`card-flight-item card-flight-item--${variant}`}
            style={style}
            data-testid={`card-flight-${variant}`}
          >
            {typeof renderCard === 'function' ? (
              renderCard({
                id: `flight-card-${id}`,
                type: cardType,
                faceDown,
                label: cardLabel,
                ruleText: cardRuleText,
                selected: false,
                disabled: false,
              })
            ) : (
              <div className={`card-flight-fallback ${faceDown ? 'card-flight-fallback--back' : ''}`}>
                {!faceDown && <span>{cardLabel || cardType}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
