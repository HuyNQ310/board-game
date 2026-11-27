import React from 'react';
import SeatRing from '../components/SeatRing.jsx';
import DrawPile from '../components/DrawPile.jsx';
import DiscardPile from '../components/DiscardPile.jsx';
import LogPanel from '../components/LogPanel.jsx';
import Toast from '../components/Toast.jsx';
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
  onDismissToast,
  onDismiss = onDismissToast,
  renderCard,
  renderLogLine,
  t,
  actionBarSlot,
  handSlot,
  children,
}) {
  const effectiveTurnsLeft = turnsLeft ?? gameState?.turnsLeft ?? 1;
  const effectiveToastMessage = toast || toastMessage;
  const effectiveOnDismissToast = onDismiss || onDismissToast;
  const effectiveEntries = entries || log || [];

  return (
    <div className="game-screen" data-testid="game-screen">
      <Toast
        message={effectiveToastMessage}
        onDismiss={effectiveOnDismissToast}
      />

      <header className="game-screen__header">
        <SeatRing
          players={players}
          myPlayerId={myPlayerId}
          currentPlayerId={currentPlayerId}
        />
      </header>

      <main className="game-screen__center">
        <DrawPile deckCount={deckCount} t={t} />

        <div className="game-screen__center-info">
          {effectiveTurnsLeft > 1 && (
            <div
              className="game-screen__turns-left"
              data-testid="turns-left"
              aria-live="polite"
            >
              Còn {effectiveTurnsLeft} lượt
            </div>
          )}
        </div>

        <DiscardPile
          discardCount={discardCount}
          discardTop={discardTop}
          renderCard={renderCard}
          t={t}
        />
      </main>

      <section
        className="game-screen__action-hand-placeholder"
        data-testid="action-hand-placeholder"
        aria-label="Khu vực bài và thao tác"
      >
        {actionBarSlot}
        {handSlot}
        {children}
      </section>

      <footer className="game-screen__footer">
        <LogPanel
          entries={effectiveEntries}
          renderLogLine={renderLogLine}
        />
      </footer>
    </div>
  );
}

export default Game;
