import { useState, useEffect } from 'react';
import { Palette, HelpCircle, LogOut, X, Mic, MicOff } from 'lucide-react';
import SeatRing from '../components/SeatRing.jsx';
import DrawPile from '../components/DrawPile.jsx';
import DiscardPile from '../components/DiscardPile.jsx';
import LogPanel from '../components/LogPanel.jsx';
import Toast from '../components/Toast.jsx';
import LocaleFlag from '../components/FlagIcon.jsx';
import './Game.css';

export function Game({
  gameState,
  myPlayerId = gameState?.myPlayerId,
  currentPlayerId = gameState?.currentPlayerId,
  turnsLeft = gameState?.turnsLeft,
  deckCount = gameState?.deckCount ?? 0,
  discardCount = gameState?.discardCount ?? 0,
  discardTop = gameState?.discardTop ?? null,
  players = gameState?.players || [],
  log = gameState?.log || [],
  entries = log,
  toastMessage,
  toast = toastMessage,
  toastVariant = 'error',
  toastKey,
  toastCloseLabel,
  onDismissToast,
  onDismiss = onDismissToast,
  renderCard,
  renderLogLine,
  t,
  locale = 'vi',
  cardTheme = 'deck1',
  tableTheme = 'pastel-green',
  direction = gameState?.direction,
  chatBubbles = {},
  topControlsSlot,
  onOpenThemePicker,
  onOpenHelp,
  onToggleLocale,
  onLeave,
  micOn = false,
  micBusy = false,
  onToggleMic,
  voicePeers = {},
  mutedVoiceIds,
  mutedChatIds,
  onToggleMuteVoice,
  onToggleMuteChat,
  actionBarSlot,
  handSlot,
  children,
}) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  useEffect(() => {
    if (!confirmingLeave) return undefined;
    const timer = setTimeout(() => setConfirmingLeave(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingLeave]);

  const effectiveTurnsLeft = turnsLeft ?? gameState?.turnsLeft ?? 1;
  const effectiveToastMessage = toast || toastMessage;
  const effectiveOnDismissToast = onDismiss || onDismissToast;
  const effectiveEntries = entries || log || [];
  const hasTopControls = Boolean(
    topControlsSlot ||
      typeof onToggleMic === 'function' ||
      onOpenThemePicker ||
      onOpenHelp ||
      onToggleLocale
  );
  const isEn = locale === 'en';
  const micLabel = micOn
    ? t?.micOn || (isEn ? 'Mic on' : 'Mic bật')
    : t?.micOff || (isEn ? 'Turn on mic' : 'Bật mic');
  const themeLabel = t?.themeLabel || (isEn ? 'Themes' : 'Giao diện');
  const themeAriaLabel =
    t?.themeAriaLabel || (isEn ? 'Customize card and table theme' : 'Tùy chỉnh giao diện bài và bàn');
  const helpAriaLabel =
    t?.helpAriaLabel || (isEn ? 'View game rules' : 'Xem hướng dẫn chơi');
  const leaveLabel = t?.leaveLabel || (isEn ? 'Leave room' : 'Rời phòng');
  const confirmLeaveLabel = t?.confirmLeaveLabel || (isEn ? 'Leave?' : 'Xác nhận rời?');
  const cancelLabel = t?.cancelLabel || (isEn ? 'Cancel' : 'Hủy');
  const turnsLeftText =
    typeof t?.turnsLeft === 'function'
      ? t.turnsLeft(effectiveTurnsLeft)
      : isEn
        ? `${effectiveTurnsLeft} ${effectiveTurnsLeft === 1 ? 'turn' : 'turns'} left`
        : `Còn ${effectiveTurnsLeft} lượt`;
  const playAreaAriaLabel =
    t?.playAreaAriaLabel || (isEn ? 'Cards and action area' : 'Khu vực bài và thao tác');

  return (
    <div
      className="game-screen"
      data-testid="game-screen"
      data-table-theme={tableTheme}
    >
      <Toast
        message={effectiveToastMessage}
        variant={toastVariant}
        toastKey={toastKey}
        closeLabel={
          toastCloseLabel ||
          t?.toastCloseLabel ||
          (isEn ? 'Dismiss notification' : 'Đóng thông báo')
        }
        onDismiss={effectiveOnDismissToast}
      />

      {typeof onLeave === 'function' && (
        <div className="game-screen__left-controls">
          {confirmingLeave ? (
            <div className="game-screen__leave-confirm" role="group" aria-label={leaveLabel}>
              <button
                type="button"
                className="game-screen__utility-btn game-screen__utility-btn--danger"
                onClick={() => {
                  setConfirmingLeave(false);
                  onLeave();
                }}
                data-testid="game-leave-confirm-btn"
              >
                <LogOut size={16} aria-hidden="true" />
                <span>{confirmLeaveLabel}</span>
              </button>
              <button
                type="button"
                className="game-screen__utility-btn game-screen__utility-btn--icon"
                onClick={() => setConfirmingLeave(false)}
                aria-label={cancelLabel}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="game-screen__utility-btn game-screen__utility-btn--leave"
              onClick={() => setConfirmingLeave(true)}
              aria-label={leaveLabel}
              title={leaveLabel}
              data-testid="game-leave-btn"
            >
              <LogOut size={17} aria-hidden="true" />
              <span className="game-screen__utility-label">{leaveLabel}</span>
            </button>
          )}
        </div>
      )}

      {hasTopControls && (
        <div className="game-screen__top-controls">
          {topControlsSlot ? (
            topControlsSlot
          ) : (
            <>
              {typeof onToggleMic === 'function' && (
                <button
                  type="button"
                  className={`game-screen__utility-btn game-screen__utility-btn--mic${
                    micOn ? ' game-screen__utility-btn--mic-on' : ''
                  }`}
                  onClick={onToggleMic}
                  aria-pressed={Boolean(micOn)}
                  aria-label={micLabel}
                  title={micLabel}
                  disabled={Boolean(micBusy)}
                  data-testid="voice-mic-toggle-btn"
                >
                  {micOn ? (
                    <Mic size={17} aria-hidden="true" />
                  ) : (
                    <MicOff size={17} aria-hidden="true" />
                  )}
                  <span className="game-screen__utility-label">{micLabel}</span>
                </button>
              )}
              {onToggleLocale && (
                <button
                  type="button"
                  className="game-screen__utility-btn game-screen__utility-btn--lang"
                  onClick={onToggleLocale}
                  aria-label={locale === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
                  title={locale === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
                  data-testid="lang-toggle-btn"
                >
                  <LocaleFlag locale={locale} size={18} />
                  <span>{locale === 'en' ? 'EN' : 'VI'}</span>
                </button>
              )}
              {onOpenThemePicker && (
                <button
                  type="button"
                  className="game-screen__utility-btn"
                  onClick={onOpenThemePicker}
                  aria-label={themeAriaLabel}
                  title={themeAriaLabel}
                >
                  <Palette size={17} aria-hidden="true" />
                  <span className="game-screen__utility-label">
                    {themeLabel}
                  </span>
                </button>
              )}
              {onOpenHelp && (
                <button
                  type="button"
                  className="game-screen__utility-btn game-screen__utility-btn--icon"
                  onClick={onOpenHelp}
                  aria-label={helpAriaLabel}
                  title={helpAriaLabel}
                >
                  <HelpCircle size={20} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      <header className="game-screen__header">
        <SeatRing
          players={players}
          myPlayerId={myPlayerId}
          currentPlayerId={currentPlayerId}
          turnDeadline={gameState?.phase !== 'over' ? gameState?.turnDeadline : null}
          phase={gameState?.phase}
          pendingDefuseId={gameState?.pendingDefuseId}
          tableTheme={tableTheme}
          direction={direction}
          chatBubbles={chatBubbles}
          voicePeers={voicePeers}
          mutedVoiceIds={mutedVoiceIds}
          mutedChatIds={mutedChatIds}
          onToggleMuteVoice={onToggleMuteVoice}
          onToggleMuteChat={onToggleMuteChat}
          t={t}
          centerContent={
            <div className="game-screen__center">
              <DrawPile deckCount={deckCount} cardTheme={cardTheme} t={t} />

              <div className="game-screen__center-info">
                {effectiveTurnsLeft > 1 && (
                  <div
                    className="game-screen__turns-left"
                    data-testid="turns-left"
                    aria-live="polite"
                  >
                    {turnsLeftText}
                  </div>
                )}
              </div>

              <DiscardPile
                discardCount={discardCount}
                discardTop={discardTop}
                renderCard={renderCard}
                t={t}
              />
            </div>
          }
        />
      </header>

      <section
        className="game-screen__action-hand-placeholder"
        data-testid="action-hand-placeholder"
        aria-label={playAreaAriaLabel}
      >
        {actionBarSlot}
        {handSlot}
        {children}
      </section>

      <footer className="game-screen__footer">
        <LogPanel
          entries={effectiveEntries}
          renderLogLine={renderLogLine}
          t={t}
          locale={locale}
        />
      </footer>
    </div>
  );
}

export default Game;
