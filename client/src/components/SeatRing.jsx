import { RotateCw, RotateCcw } from 'lucide-react';
import './SeatRing.css';

/**
 * Computes angular distribution (in degrees) for opponent seats along an ellipse arc.
 *
 * Angle convention:
 * - 0° is East (right)
 * - 90° is South (bottom, viewer's self seat)
 * - 180° is West (left)
 * - 270° is North (top)
 *
 * Arc design:
 * - 1 opponent (2 players total, heads-up): 270° (top-center, directly opposite self).
 * - 2-3 opponents (3-4 players total): comfortable upper arc (130°-175° span).
 * - 4-9 opponents (5-10 players total): arc expands up to 250° across sides and top,
 *   leaving the bottom arc (~90°) clear for the self player's seat.
 * - Uses numerical integration for ellipse arc length so seats are spaced
 *   evenly by physical distance along the table perimeter, preventing crowded
 *   shoulders or overlapping seats even at maximum capacity (10 players).
 */
function getArcAngles(count, rx = 42, ry = 37) {
  if (count <= 0) return [];
  if (count === 1) return [270];

  const spanMap = {
    2: 130,
    3: 175,
    4: 205,
    5: 225,
    6: 235,
    7: 245,
  };
  const span = spanMap[count] || 250;
  const startDeg = 270 - span / 2;
  const endDeg = 270 + span / 2;

  const tStart = (startDeg * Math.PI) / 180;
  const tEnd = (endDeg * Math.PI) / 180;

  // Numerical approximation of ellipse arc length
  function arcLength(t1, t2, steps = 24) {
    const dt = (t2 - t1) / steps;
    let s = 0;
    for (let i = 0; i < steps; i++) {
      const t = t1 + (i + 0.5) * dt;
      s += Math.sqrt((rx * Math.sin(t)) ** 2 + (ry * Math.cos(t)) ** 2) * dt;
    }
    return s;
  }

  const totalArc = arcLength(tStart, tEnd);
  const targetStep = totalArc / (count - 1);
  const angles = [startDeg];

  for (let i = 1; i < count - 1; i++) {
    const targetS = i * targetStep;
    let lo = tStart;
    let hi = tEnd;
    for (let iter = 0; iter < 16; iter++) {
      const mid = (lo + hi) / 2;
      if (arcLength(tStart, mid, 16) < targetS) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    angles.push(Number(((lo * 180) / Math.PI).toFixed(1)));
  }
  angles.push(endDeg);
  return angles;
}

/**
 * Computes (x%, y%) coordinates on an ellipse for each opponent seat.
 * Center is (cx, cy) and radii are (rx, ry) in container percentages.
 * - If self seat exists: cy=47% (slightly above vertical center), leaving bottom clear for self.
 * - If spectator (no self seat): distributes all seats around full 360° oval.
 */
function computeSeatPositions(opponentsCount, hasSelf = true) {
  const cx = 50;
  const cy = hasSelf ? 48 : 50;
  const rx = 46;
  const ry = hasSelf ? 43 : 44;

  if (!hasSelf) {
    if (opponentsCount <= 0) return [];
    if (opponentsCount === 1) return [{ x: 50, y: 8, angle: 270 }];
    const step = 360 / opponentsCount;
    return Array.from({ length: opponentsCount }, (_, i) => {
      const deg = 270 + i * step;
      const rad = (deg * Math.PI) / 180;
      return {
        x: Number((cx + rx * Math.cos(rad)).toFixed(1)),
        y: Number((cy + ry * Math.sin(rad)).toFixed(1)),
        angle: Number(deg.toFixed(1)),
      };
    });
  }

  const angles = getArcAngles(opponentsCount, rx, ry);
  return angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: Number((cx + rx * Math.cos(rad)).toFixed(1)),
      y: Number((cy + ry * Math.sin(rad)).toFixed(1)),
      angle: deg,
    };
  });
}

export function SeatRing({
  players = [],
  myPlayerId,
  currentPlayerId,
  centerContent = null,
  direction,
  t = {},
  tableTheme = 'pastel-green',
  chatBubbles = {},
}) {
  const safePlayers = Array.isArray(players) ? players : [];
  const hasDirection = direction === 1 || direction === -1;
  const rawDirectionLabel =
    direction === 1
      ? t?.directionCw || 'Thuận chiều'
      : direction === -1
        ? t?.directionCcw || 'Ngược chiều'
        : null;
  const directionLabel = rawDirectionLabel
    ? rawDirectionLabel.replace(/^[↻↺]\s*/, '')
    : null;

  const selfPlayer = safePlayers.find((p) => p && p.id === myPlayerId);
  const opponents = safePlayers.filter((p) => p && p.id !== myPlayerId);

  const hasSelf = Boolean(selfPlayer);
  const opponentPositions = computeSeatPositions(opponents.length, hasSelf);

  const isDense = safePlayers.length >= 7;

  const youTag = t?.seat?.youTag || t?.youTag || '(Bạn)';
  const turnLabel = t?.seat?.turn || t?.turn || 'Đến lượt';
  const eliminatedLabel = t?.seat?.eliminated || t?.eliminated || 'Đã bị loại';
  const offlineLabel = t?.seat?.offline || t?.offline || 'Offline';
  const cardsCountFn = t?.seat?.cardsCount || t?.cardsCount;
  const formatCardsCount = (count) =>
    typeof cardsCountFn === 'function' ? cardsCountFn(count) : `${count} lá`;
  const seatRingAriaLabel = t?.seatRingAriaLabel || t?.seat?.ringAriaLabel || 'Ghế người chơi';

  const renderSeat = (player, isSelf = false, position = null) => {
    if (!player) return null;
    const isCurrent = player.id === currentPlayerId;
    const isAlive = player.alive !== false;
    const isConnected = player.connected !== false;

    const seatClasses = [
      'seat-ring__seat',
      isSelf ? 'seat-ring__seat--self' : 'seat-ring__seat--opponent',
      isCurrent ? 'seat-ring__seat--current' : '',
      !isAlive ? 'seat-ring__seat--eliminated' : '',
      !isConnected ? 'seat-ring__seat--offline' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const initial = player.name ? player.name.trim().charAt(0).toUpperCase() : '?';

    const seatStyle = position
      ? {
          '--seat-x': `${position.x}%`,
          '--seat-y': `${position.y}%`,
          left: `${position.x}%`,
          top: `${position.y}%`,
        }
      : undefined;

    const bubble = chatBubbles?.[player.id];

    return (
      <div
        key={player.id}
        className={seatClasses}
        data-player-id={player.id}
        data-testid={`seat-${player.id}`}
        aria-label={`${player.name}${isSelf ? ` ${youTag}` : ''}`}
        style={seatStyle}
      >
        {bubble?.text && (
          <div
            className="seat-ring__chat-bubble"
            data-testid={`chat-bubble-${player.id}`}
            role="status"
            aria-live="polite"
          >
            {bubble.text}
          </div>
        )}
        <div className="seat-ring__avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="seat-ring__details">
          <div className="seat-ring__name" title={player.name}>
            {player.name}
            {isSelf && <span className="seat-ring__self-tag"> {youTag}</span>}
          </div>
          <div className="seat-ring__hand-count">
            {formatCardsCount(player.handCount ?? 0)}
          </div>
        </div>
        <div className="seat-ring__badges">
          {isCurrent && (
            <span className="seat-ring__badge seat-ring__badge--current">
              {turnLabel}
            </span>
          )}
          {!isAlive && (
            <span className="seat-ring__badge seat-ring__badge--eliminated">
              {eliminatedLabel}
            </span>
          )}
          {!isConnected && (
            <span className="seat-ring__badge seat-ring__badge--offline">
              {offlineLabel}
            </span>
          )}
        </div>
      </div>
    );
  };

  const rootClasses = [
    'seat-ring',
    isDense ? 'seat-ring--dense' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClasses}
      data-testid="seat-ring"
      data-table-theme={tableTheme}
      role="region"
      aria-label={seatRingAriaLabel}
      style={{ '--seat-count': safePlayers.length }}
    >
      <div className="seat-ring__table">
        <div className="seat-ring__felt" aria-hidden={centerContent || hasDirection ? undefined : 'true'}>
          {(centerContent || hasDirection) && (
            <div className="seat-ring__center" data-testid="seat-ring-center">
              {hasDirection && (
                <div
                  className={`seat-ring__direction-badge ${
                    direction === -1
                      ? 'seat-ring__direction-badge--ccw'
                      : 'seat-ring__direction-badge--cw'
                  }`}
                  data-testid="seat-ring-direction"
                  aria-label={directionLabel}
                  style={{ gap: '4px' }}
                >
                  {direction === -1 ? (
                    <RotateCcw size={13} aria-hidden="true" />
                  ) : (
                    <RotateCw size={13} aria-hidden="true" />
                  )}
                  <span>{directionLabel}</span>
                </div>
              )}
              {centerContent}
            </div>
          )}
        </div>
        <div className="seat-ring__opponents">
          {opponents.map((player, index) =>
            renderSeat(player, false, opponentPositions[index])
          )}
        </div>
        {selfPlayer && (
          <div className="seat-ring__self-area">
            {renderSeat(selfPlayer, true)}
          </div>
        )}
      </div>
    </div>
  );
}

export default SeatRing;
