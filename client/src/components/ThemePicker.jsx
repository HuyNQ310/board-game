/**
 * ThemePicker.jsx
 * Accessible modal dialog for switching Card Deck Theme and Table Theme.
 */

import { useEffect } from 'react';
import { Palette, X, Check } from 'lucide-react';
import {
  CARD_THEMES,
  TABLE_THEMES,
  DEFAULT_CARD_THEME,
  DEFAULT_TABLE_THEME,
} from '../state/themes.js';
import './ThemePicker.css';

const THEME_LABELS_EN = {
  deck1: {
    name: 'Deck #1 (Illustrated)',
    description: 'Latest hand-drawn cat illustrations',
  },
  deck2: {
    name: 'Deck #2 (Classic)',
    description: 'Minimalist traditional vector style',
  },
  deck3: {
    name: 'Deck #3 (Neon Night)',
    description: 'High-contrast dark night theme',
  },
  'pastel-yellow': {
    name: 'Pastel Yellow Table',
    description: 'Warm, soothing cream yellow',
  },
  'pastel-pink': {
    name: 'Pastel Pink Table',
    description: 'Soft, cheerful blush pink',
  },
  'pastel-green': {
    name: 'Pastel Green Table',
    description: 'Refreshing, gentle mint green',
  },
  'pastel-blue': {
    name: 'Pastel Blue Table',
    description: 'Clean, calm sky blue',
  },
};

/**
 * Compact trigger button for opening the ThemePicker modal.
 */
export function ThemeButton({ onClick, label, locale = 'vi', className = '' }) {
  const buttonLabel = label || (locale === 'en' ? 'Themes' : 'Giao diện');
  return (
    <button
      type="button"
      className={`theme-picker-trigger ${className}`.trim()}
      onClick={onClick}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      <Palette size={17} aria-hidden="true" />
      <span className="theme-picker-trigger__label">{buttonLabel}</span>
    </button>
  );
}

/**
 * Modal dialog allowing players to preview and select card deck & table themes.
 */
export default function ThemePicker({
  open = false,
  onClose,
  cardTheme = DEFAULT_CARD_THEME,
  onSelectCardTheme,
  tableTheme = DEFAULT_TABLE_THEME,
  onSelectTableTheme,
  locale = 'vi',
  t = {},
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onClose === 'function') {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof onClose === 'function') {
      onClose();
    }
  };

  const isEn = locale === 'en';
  const titleText = t.title || (isEn ? 'Customize Appearance' : 'Tùy chỉnh giao diện');
  const closeText = t.close || (isEn ? 'Close' : 'Đóng');
  const cardHeadingText =
    t.cardThemeHeading || (isEn ? 'Choose Card Deck Theme' : 'Chọn giao diện lá bài');
  const tableHeadingText =
    t.tableThemeHeading || (isEn ? 'Choose Table Theme' : 'Chọn giao diện bàn chơi');
  const activeBadgeText = t.activeBadge || (isEn ? 'Active' : 'Đang dùng');

  const getThemeLabel = (theme) => {
    if (isEn && THEME_LABELS_EN[theme.id]) {
      return THEME_LABELS_EN[theme.id];
    }
    return theme;
  };

  return (
    <div
      className="theme-picker-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="theme-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-picker-title"
      >
        <header className="theme-picker-header">
          <div className="theme-picker-header__title-group">
            <span className="theme-picker-header__icon" aria-hidden="true">
              <Palette size={20} aria-hidden="true" />
            </span>
            <h2 id="theme-picker-title" className="theme-picker-header__title">
              {titleText}
            </h2>
          </div>
          <button
            type="button"
            className="theme-picker-close-icon-btn"
            onClick={onClose}
            aria-label={closeText}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="theme-picker-body">
          <section className="theme-picker-section" aria-labelledby="card-theme-heading">
            <h3 id="card-theme-heading" className="theme-picker-section__title">
              {cardHeadingText}
            </h3>
            <div className="theme-picker-grid">
              {CARD_THEMES.map((theme) => {
                const isActive = cardTheme === theme.id;
                const display = getThemeLabel(theme);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-picker-option ${isActive ? 'theme-picker-option--active' : ''}`}
                    onClick={() => onSelectCardTheme?.(theme.id)}
                    aria-pressed={isActive}
                  >
                    <span
                      className="theme-picker-swatch theme-picker-swatch--card"
                      style={{ backgroundColor: theme.previewColor }}
                      aria-hidden="true"
                    />
                    <span className="theme-picker-option__info">
                      <span className="theme-picker-option__header">
                        <span className="theme-picker-option__name">{display.name}</span>
                        {isActive && (
                          <span className="theme-picker-badge">
                            <Check size={13} aria-hidden="true" /> {activeBadgeText}
                          </span>
                        )}
                      </span>
                      <span className="theme-picker-option__desc">{display.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="theme-picker-section" aria-labelledby="table-theme-heading">
            <h3 id="table-theme-heading" className="theme-picker-section__title">
              {tableHeadingText}
            </h3>
            <div className="theme-picker-grid">
              {TABLE_THEMES.map((theme) => {
                const isActive = tableTheme === theme.id;
                const display = getThemeLabel(theme);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-picker-option ${isActive ? 'theme-picker-option--active' : ''}`}
                    onClick={() => onSelectTableTheme?.(theme.id)}
                    aria-pressed={isActive}
                  >
                    <span
                      className="theme-picker-swatch theme-picker-swatch--table"
                      style={{
                        backgroundColor: theme.previewBg,
                        borderColor: theme.previewBorder,
                      }}
                      aria-hidden="true"
                    />
                    <span className="theme-picker-option__info">
                      <span className="theme-picker-option__header">
                        <span className="theme-picker-option__name">{display.name}</span>
                        {isActive && (
                          <span className="theme-picker-badge">
                            <Check size={13} aria-hidden="true" /> {activeBadgeText}
                          </span>
                        )}
                      </span>
                      <span className="theme-picker-option__desc">{display.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="theme-picker-footer">
          <button
            type="button"
            className="theme-picker-footer__close-btn"
            onClick={onClose}
            aria-label={closeText}
          >
            {closeText}
          </button>
        </footer>
      </div>
    </div>
  );
}
