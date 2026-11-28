/**
 * Shape of `t` (translations / display strings) expected by Lobby:
 * - t.title: Title for the lobby screen (default: "Phòng chờ")
 * - t.roomCodeLabel: Label for room code (default: "Mã phòng")
 * - t.copyCodeButton: Button text for copy code (default: "Sao chép")
 * - t.copyCodeAriaLabel: Accessible label for copy button (default: "Sao chép mã phòng")
 * - t.shareCodeButton: Button text for share code (default: "Chia sẻ")
 * - t.shareCodeAriaLabel: Accessible label for share button (default: "Chia sẻ mã phòng")
 * - t.playerListTitle: Header for players section (default: "Người chơi")
 * - t.seatLabel: Label for player seat (default: "Ghế")
 * - t.hostBadge: Text for room host badge (default: "Chủ phòng")
 * - t.offlineBadge: Text for disconnected player badge (default: "Đang offline")
 * - t.onlineBadge: Text for connected player status (default: "Sẵn sàng")
 * - t.startButton: Text for game start button (default: "Bắt đầu")
 * - t.waitingForHostMessage: Message shown to non-host players (default: "Đang chờ chủ phòng bắt đầu")
 * - t.leaveRoomButton: Text for leave room button (default: "Rời phòng")
 */

import {
  Palette,
  Copy,
  Share2,
  AlertTriangle,
  Clock,
  Crown,
  WifiOff,
  Wifi,
} from 'lucide-react';
import LocaleFlag from '../components/FlagIcon.jsx';
import './Lobby.css';

export function Lobby({
  t,
  roomCode,
  players = [],
  isHost,
  canStart,
  startDisabledReason,
  onStart,
  onCopyCode,
  onShareCode,
  onLeave,
  onOpenThemePicker,
  tableTheme = 'pastel-green',
  locale = 'vi',
  onToggleLocale,
}) {
  const sortedPlayers = Array.isArray(players)
    ? [...players].sort((a, b) => {
        const seatA = typeof a?.seat === 'number' ? a.seat : 0;
        const seatB = typeof b?.seat === 'number' ? b.seat : 0;
        return seatA - seatB;
      })
    : [];

  return (
    <main className="lobby-screen" data-table-theme={tableTheme}>
      <header className="lobby-header">
        <h1 className="lobby-title">{t?.title || 'Phòng chờ'}</h1>
        {(typeof onToggleLocale === 'function' || typeof onOpenThemePicker === 'function') && (
          <div className="lobby-topbar-actions">
            {typeof onToggleLocale === 'function' && (
              <button
                type="button"
                className="btn btn-outline btn-lang-toggle"
                onClick={onToggleLocale}
                aria-label={locale === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
                data-testid="lang-toggle-btn"
              >
                <LocaleFlag locale={locale} size={18} />
                <span>{locale === 'en' ? 'EN' : 'VI'}</span>
              </button>
            )}
            {typeof onOpenThemePicker === 'function' && (
              <button
                type="button"
                className="btn btn-outline btn-theme-picker"
                onClick={onOpenThemePicker}
                aria-label={locale === 'en' ? 'Choose card and table theme' : 'Chọn giao diện bài và bàn'}
              >
                <Palette size={16} aria-hidden="true" />{' '}
                {t?.themeButton || (locale === 'en' ? 'Themes' : 'Giao diện')}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="lobby-layout">
        <div className="lobby-sidebar">
          {/* Room code display with Copy and Share buttons */}
          <section className="lobby-card lobby-code-card" aria-labelledby="lobby-code-label">
            <span id="lobby-code-label" className="lobby-code-label">
              {t?.roomCodeLabel || 'Mã phòng'}
            </span>
            <div className="lobby-code-display" aria-label={`${t?.roomCodeLabel || 'Mã phòng'}: ${roomCode || ''}`}>
              {roomCode || '-----'}
            </div>
            <div className="lobby-code-actions">
              <button
                type="button"
                className="btn btn-action btn-copy"
                onClick={onCopyCode}
                aria-label={t?.copyCodeAriaLabel || 'Sao chép mã phòng'}
              >
                <Copy size={16} aria-hidden="true" /> {t?.copyCodeButton || 'Sao chép'}
              </button>
              <button
                type="button"
                className="btn btn-action btn-share"
                onClick={onShareCode}
                aria-label={t?.shareCodeAriaLabel || 'Chia sẻ mã phòng'}
              >
                <Share2 size={16} aria-hidden="true" /> {t?.shareCodeButton || 'Chia sẻ'}
              </button>
            </div>
          </section>

          {/* Footer controls: Host start vs non-host waiting, plus Leave button */}
          <footer className="lobby-footer">
            {isHost ? (
              <div className="lobby-start-container">
                <button
                  type="button"
                  className="btn btn-primary lobby-btn-start"
                  onClick={onStart}
                  disabled={!canStart}
                  title={!canStart && startDisabledReason ? startDisabledReason : undefined}
                  aria-describedby={!canStart && startDisabledReason ? 'start-disabled-reason' : undefined}
                >
                  {t?.startButton || 'Bắt đầu'}
                </button>
                {!canStart && startDisabledReason && (
                  <p id="start-disabled-reason" className="lobby-disabled-reason" role="status">
                    <AlertTriangle size={15} aria-hidden="true" />
                    {startDisabledReason}
                  </p>
                )}
              </div>
            ) : (
              <div className="lobby-waiting-container" role="status" aria-live="polite">
                <Clock className="waiting-icon" size={18} aria-hidden="true" />
                <p className="waiting-text">
                  {t?.waitingForHostMessage || 'Đang chờ chủ phòng bắt đầu'}
                </p>
              </div>
            )}

            <div className="lobby-leave-container">
              <button
                type="button"
                className="btn btn-outline lobby-btn-leave"
                onClick={onLeave}
              >
                {t?.leaveRoomButton || 'Rời phòng'}
              </button>
            </div>
          </footer>
        </div>

        {/* Player list by seat */}
        <section className="lobby-card lobby-players-section" aria-labelledby="lobby-players-title">
          <div className="lobby-players-header">
            <h2 id="lobby-players-title" className="lobby-players-title">
              {t?.playerListTitle || 'Người chơi'}
            </h2>
            <span className="lobby-player-count">
              {sortedPlayers.length}/10
            </span>
          </div>

          <ul className="lobby-player-list">
            {sortedPlayers.map((player, index) => {
              const seatNumber = typeof player?.seat === 'number' ? player.seat + 1 : index + 1;
              const isConnected = player?.connected !== false;

              return (
                <li
                  key={player?.id || index}
                  className={`lobby-player-item ${!isConnected ? 'player-offline' : ''}`}
                >
                  <div className="lobby-player-info">
                    <span className="player-seat">
                      {(t?.seatLabel || 'Ghế')} {seatNumber}
                    </span>
                    <span className="player-name">{player?.name || ''}</span>
                  </div>

                  <div className="lobby-player-badges">
                    {player?.isHost && (
                      <span className="badge badge-host" aria-label={t?.hostBadge || 'Chủ phòng'}>
                        <Crown size={13} aria-hidden="true" /> {t?.hostBadge || 'Chủ phòng'}
                      </span>
                    )}
                    {!isConnected ? (
                      <span className="badge badge-offline" aria-label={t?.offlineBadge || 'Đang offline'}>
                        <WifiOff size={13} aria-hidden="true" /> {t?.offlineBadge || 'Đang offline'}
                      </span>
                    ) : (
                      <span className="badge badge-online" aria-label={t?.onlineBadge || 'Sẵn sàng'}>
                        <Wifi size={13} aria-hidden="true" /> {t?.onlineBadge || 'Sẵn sàng'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default Lobby;
