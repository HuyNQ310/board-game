import React from 'react';
import './SeatRing.css';

export function SeatRing({ players = [], myPlayerId, currentPlayerId }) {
  const safePlayers = Array.isArray(players) ? players : [];

  const selfPlayer = safePlayers.find((p) => p && p.id === myPlayerId);
  const opponents = safePlayers.filter((p) => p && p.id !== myPlayerId);

  const renderSeat = (player, isSelf = false) => {
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

    return (
      <div
        key={player.id}
        className={seatClasses}
        data-player-id={player.id}
        data-testid={`seat-${player.id}`}
        aria-label={`${player.name}${isSelf ? ' (Bạn)' : ''}`}
      >
        <div className="seat-ring__avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="seat-ring__details">
          <div className="seat-ring__name" title={player.name}>
            {player.name}
            {isSelf && <span className="seat-ring__self-tag"> (Bạn)</span>}
          </div>
          <div className="seat-ring__hand-count">
            {player.handCount ?? 0} lá
          </div>
        </div>
        <div className="seat-ring__badges">
          {isCurrent && (
            <span className="seat-ring__badge seat-ring__badge--current">
              Đến lượt
            </span>
          )}
          {!isAlive && (
            <span className="seat-ring__badge seat-ring__badge--eliminated">
              Đã bị loại
            </span>
          )}
          {!isConnected && (
            <span className="seat-ring__badge seat-ring__badge--offline">
              Offline
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="seat-ring"
      data-testid="seat-ring"
      role="region"
      aria-label="Ghế người chơi"
    >
      <div className="seat-ring__opponents">
        {opponents.map((player) => renderSeat(player, false))}
      </div>
      {selfPlayer && (
        <div className="seat-ring__self-area">
          {renderSeat(selfPlayer, true)}
        </div>
      )}
    </div>
  );
}

export default SeatRing;
