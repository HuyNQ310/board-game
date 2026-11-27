/**
 * GameOver Screen Component
 *
 * Presentational screen shown when a game concludes (rules.md section 8.2).
 * Pure props-driven component with no direct i18n, socket, or state store imports.
 *
 * Expected `t` translation keys (consistent with Home/Lobby naming style):
 * - t.gameOverTitle: Screen header title (fallback: "Kết thúc ván")
 * - t.winnerMessage: Label or prefix for winner announcement (fallback: "Người chiến thắng")
 * - t.noWinnerMessage: Message when winnerName is null/falsy (draw per rules.md 4.5) (fallback: "Không ai thắng")
 * - t.rematchButton: Text for rematch button, visible only to host (fallback: "Chơi lại")
 * - t.leaveButton: Text for leave room button (fallback: "Rời phòng")
 * - t.waitingForRematchMessage: Notice for non-host players (fallback: "Đang chờ chủ phòng chơi lại")
 */
import './GameOver.css';

export default function GameOver({
  t = {},
  winnerName,
  isHost = false,
  onRematch,
  onLeave,
}) {
  const hasWinner = Boolean(winnerName && String(winnerName).trim());

  return (
    <div className="gameover-container">
      <div className="gameover-card">
        <h1 className="gameover-title">
          {t?.gameOverTitle || t?.gameOverMessage || 'Kết thúc ván'}
        </h1>

        <div className="gameover-result-section" aria-live="polite">
          {hasWinner ? (
            <div className="gameover-winner-badge">
              <span className="gameover-winner-icon" aria-hidden="true">
                👑
              </span>
              {t?.winnerMessage ? (
                <span className="gameover-winner-label">{t.winnerMessage}</span>
              ) : null}
              <div className="gameover-winner-name">{winnerName}</div>
            </div>
          ) : (
            <div className="gameover-draw-badge">
              <span className="gameover-draw-icon" aria-hidden="true">
                🤝
              </span>
              <div className="gameover-draw-message">
                {t?.noWinnerMessage || 'Không ai thắng'}
              </div>
            </div>
          )}
        </div>

        <div className="gameover-actions">
          {isHost ? (
            <button
              type="button"
              className="gameover-btn gameover-btn-rematch"
              onClick={onRematch}
            >
              {t?.rematchButton || 'Chơi lại'}
            </button>
          ) : (
            <p className="gameover-waiting-message" role="status">
              {t?.waitingForRematchMessage || 'Đang chờ chủ phòng chơi lại'}
            </p>
          )}

          <button
            type="button"
            className="gameover-btn gameover-btn-leave"
            onClick={onLeave}
          >
            {t?.leaveButton || 'Rời phòng'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { GameOver };
