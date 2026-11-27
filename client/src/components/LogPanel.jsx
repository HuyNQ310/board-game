import { useEffect, useRef } from 'react';
import './LogPanel.css';

function fallbackRenderLogLine(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  const parts = [entry.actor, entry.type, entry.target, entry.reason, entry.winnerId]
    .filter(Boolean)
    .join(' ');
  return parts || JSON.stringify(entry);
}

export function LogPanel({ entries = [], renderLogLine }) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      bottomRef.current.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    }
  }, [safeEntries]);

  const renderFn = typeof renderLogLine === 'function' ? renderLogLine : fallbackRenderLogLine;

  return (
    <div
      className="log-panel"
      data-testid="log-panel"
      role="region"
      aria-label="Nhật ký trò chơi"
    >
      <div className="log-panel__header">
        <h3 className="log-panel__title">Nhật ký</h3>
      </div>
      <div
        className="log-panel__content"
        role="log"
        aria-live="polite"
        tabIndex={0}
      >
        {safeEntries.length === 0 ? (
          <div className="log-panel__empty">Chưa có nhật ký</div>
        ) : (
          safeEntries.map((entry, index) => (
            <div
              key={index}
              className="log-panel__entry"
              data-testid={`log-entry-${index}`}
            >
              {renderFn(entry)}
            </div>
          ))
        )}
        <div ref={bottomRef} className="log-panel__anchor" aria-hidden="true" />
      </div>
    </div>
  );
}

export default LogPanel;
