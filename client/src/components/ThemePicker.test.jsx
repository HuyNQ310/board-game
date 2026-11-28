// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ThemePicker from './ThemePicker.jsx';
import {
  CARD_THEMES,
  TABLE_THEMES,
  DEFAULT_CARD_THEME,
  DEFAULT_TABLE_THEME,
  getStoredCardTheme,
  setStoredCardTheme,
  getStoredTableTheme,
  setStoredTableTheme,
} from '../state/themes.js';

afterEach(() => {
  cleanup();
});

describe('ThemePicker', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<ThemePicker open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays all 3 card themes and 4 table themes when open is true', () => {
    render(
      <ThemePicker
        open={true}
        cardTheme="deck1"
        tableTheme="pastel-green"
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Chọn giao diện lá bài')).toBeDefined();
    expect(screen.getByText('Chọn giao diện bàn chơi')).toBeDefined();

    for (const theme of CARD_THEMES) {
      expect(screen.getByText(theme.name)).toBeDefined();
      expect(screen.getByText(theme.description)).toBeDefined();
    }

    for (const theme of TABLE_THEMES) {
      expect(screen.getByText(theme.name)).toBeDefined();
      expect(screen.getByText(theme.description)).toBeDefined();
    }

    const activeBadges = screen.getAllByText('Đang dùng');
    expect(activeBadges).toHaveLength(2);
  });

  it('calls onSelectCardTheme and onSelectTableTheme when theme options are clicked', () => {
    const onSelectCardTheme = vi.fn();
    const onSelectTableTheme = vi.fn();

    render(
      <ThemePicker
        open={true}
        cardTheme="deck1"
        tableTheme="pastel-green"
        onSelectCardTheme={onSelectCardTheme}
        onSelectTableTheme={onSelectTableTheme}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Bộ bài số 3 \(Đêm Neon\)/i }));
    expect(onSelectCardTheme).toHaveBeenCalledTimes(1);
    expect(onSelectCardTheme).toHaveBeenCalledWith('deck3');

    fireEvent.click(screen.getByRole('button', { name: /Bàn Hồng Pastel/i }));
    expect(onSelectTableTheme).toHaveBeenCalledTimes(1);
    expect(onSelectTableTheme).toHaveBeenCalledWith('pastel-pink');

    fireEvent.click(screen.getByRole('button', { name: /Bàn Vàng Pastel/i }));
    expect(onSelectTableTheme).toHaveBeenCalledWith('pastel-yellow');

    fireEvent.click(screen.getByRole('button', { name: /Bàn Xanh Dương Pastel/i }));
    expect(onSelectTableTheme).toHaveBeenCalledWith('pastel-blue');
  });

  it('closes on Escape key and close buttons', () => {
    const onClose = vi.fn();
    render(<ThemePicker open={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButtons = screen.getAllByRole('button', { name: 'Đóng' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<ThemePicker open={true} onClose={onClose} />);

    const backdrop = container.querySelector('.theme-picker-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('themes storage helpers', () => {
  it('reads and writes card and table themes safely', () => {
    window.localStorage.clear();
    expect(DEFAULT_TABLE_THEME).toBe('pastel-green');
    expect(getStoredCardTheme()).toBe(DEFAULT_CARD_THEME);
    expect(getStoredTableTheme()).toBe('pastel-green');

    setStoredCardTheme('deck2');
    setStoredTableTheme('pastel-blue');

    expect(getStoredCardTheme()).toBe('deck2');
    expect(getStoredTableTheme()).toBe('pastel-blue');

    // Falls back to DEFAULT_TABLE_THEME for unknown/legacy theme IDs
    window.localStorage.setItem('meo-no:tableTheme', 'classic');
    expect(getStoredTableTheme()).toBe('pastel-green');
  });
});
