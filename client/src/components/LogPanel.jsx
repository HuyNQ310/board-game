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
  const contentRef = useRef(null);

  useEffect(() => {
    // Scroll ONLY this panel's own internal list (contentRef), by setting
    // its scrollTop directly -- never the page. `scrollIntoView` (even with
    // `block: 'nearest'`) falls back to scrolling the whole document when
    // the log list hasn't overflowed yet (e.g. it's empty or has just one
    // entry, so it isn't a "scrollable ancestor" yet), which was jumping
    // the entire Game screen down on load and hiding the top player's seat.
    const content = contentRef.current;
    if (!content) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof content.scrollTo === 'function') {
      content.scrollTo({
        top: content.scrollHeight,
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    } else {
      content.scrollTop = content.scrollHeight;
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
        ref={contentRef}
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
