import { useEffect, useRef, useState } from 'react';
import './LogPanel.css';

function fallbackRenderLogLine(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  const parts = [entry.actor, entry.type, entry.target, entry.reason, entry.winnerId]
    .filter(Boolean)
    .join(' ');
  return parts || JSON.stringify(entry);
}

export function LogPanel({
  entries = [],
  renderLogLine,
  defaultCollapsed = true,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  t = {},
  locale = 'vi',
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!isCollapsed);
    }
    if (controlledCollapsed === undefined) {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const safeEntries = Array.isArray(entries) ? entries : [];
  const bottomRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (isCollapsed) return;
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
  }, [safeEntries, isCollapsed]);

  const renderFn = typeof renderLogLine === 'function' ? renderLogLine : fallbackRenderLogLine;

  const rootClasses = [
    'log-panel',
    isCollapsed ? 'log-panel--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isEn = locale === 'en';
  const regionAriaLabel =
    t?.logAriaLabel || (isEn ? 'Game activity log' : 'Nhật ký trò chơi');
  const titleText = t?.logTitle || (isEn ? 'Game log' : 'Nhật ký');
  const toggleAriaLabel = isCollapsed
    ? t?.logExpandAriaLabel || (isEn ? 'Expand game log' : 'Mở rộng nhật ký')
    : t?.logCollapseAriaLabel || (isEn ? 'Collapse game log' : 'Thu gọn nhật ký');
  const emptyText = t?.logEmpty || (isEn ? 'No activity yet' : 'Chưa có nhật ký');

  return (
    <div
      className={rootClasses}
      data-testid="log-panel"
      role="region"
      aria-label={regionAriaLabel}
    >
      <div className="log-panel__header">
        <h3 className="log-panel__title">{titleText}</h3>
        <button
          type="button"
          className="log-panel__toggle-btn"
          onClick={handleToggle}
          aria-expanded={!isCollapsed}
          aria-controls="log-panel-content"
          aria-label={toggleAriaLabel}
        >
          <span className="log-panel__toggle-icon" aria-hidden="true">
            {isCollapsed ? '▲' : '▼'}
          </span>
        </button>
      </div>
      <div
        id="log-panel-content"
        className="log-panel__content"
        role="log"
        aria-live="polite"
        tabIndex={isCollapsed ? -1 : 0}
        aria-hidden={isCollapsed}
        ref={contentRef}
      >
        {safeEntries.length === 0 ? (
          <div className="log-panel__empty">{emptyText}</div>
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
