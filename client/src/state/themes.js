/**
 * themes.js
 * Definitions and safe localStorage persistence for Card Deck & Table Themes.
 */

export const DEFAULT_CARD_THEME = 'deck1';
export const DEFAULT_TABLE_THEME = 'pastel-green';

export const CARD_THEMES = [
  {
    id: 'deck1',
    name: 'Bộ bài số 1 (Minh họa)',
    description: 'Bộ ảnh mèo vẽ tay mới nhất',
    previewColor: '#B71C1C',
  },
  {
    id: 'deck2',
    name: 'Bộ bài số 2 (Cổ điển)',
    description: 'Giao diện vector tối giản truyền thống',
    previewColor: '#2E3A4B',
  },
  {
    id: 'deck3',
    name: 'Bộ bài số 3 (Đêm Neon)',
    description: 'Nền tối tương phản cao ban đêm',
    previewColor: '#1E1B22',
  },
];

export const TABLE_THEMES = [
  {
    id: 'pastel-yellow',
    name: 'Bàn Vàng Pastel',
    description: 'Vàng kem dịu mắt, ấm áp',
    previewBg: '#fceaa8',
    previewBorder: '#dfb552',
  },
  {
    id: 'pastel-pink',
    name: 'Bàn Hồng Pastel',
    description: 'Hồng phấn nhẹ nhàng, tươi tắn',
    previewBg: '#fad2df',
    previewBorder: '#dc8ba6',
  },
  {
    id: 'pastel-green',
    name: 'Bàn Xanh Lá Pastel',
    description: 'Xanh bạc hà dịu nhẹ, dễ chịu',
    previewBg: '#b8e2c4',
    previewBorder: '#7eb892',
  },
  {
    id: 'pastel-blue',
    name: 'Bàn Xanh Dương Pastel',
    description: 'Xanh trời pastel thanh lịch',
    previewBg: '#c4e2fb',
    previewBorder: '#6fa7db',
  },
];

const CARD_THEME_STORAGE_KEY = 'meo-no:cardTheme';
const TABLE_THEME_STORAGE_KEY = 'meo-no:tableTheme';

function readStoredTheme(key, validThemes, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }
    const stored = window.localStorage.getItem(key);
    if (stored && validThemes.some((theme) => theme.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors in SSR, private mode, or restricted contexts
  }
  return fallback;
}

function writeStoredTheme(key, validThemes, id) {
  if (!validThemes.some((theme) => theme.id === id)) {
    return;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, id);
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Reads the persisted card theme ID from localStorage, falling back to DEFAULT_CARD_THEME.
 * @returns {string}
 */
export function getStoredCardTheme() {
  return readStoredTheme(CARD_THEME_STORAGE_KEY, CARD_THEMES, DEFAULT_CARD_THEME);
}

/**
 * Persists a valid card theme ID to localStorage.
 * @param {string} id
 */
export function setStoredCardTheme(id) {
  writeStoredTheme(CARD_THEME_STORAGE_KEY, CARD_THEMES, id);
}

/**
 * Reads the persisted table theme ID from localStorage, falling back to DEFAULT_TABLE_THEME.
 * @returns {string}
 */
export function getStoredTableTheme() {
  return readStoredTheme(TABLE_THEME_STORAGE_KEY, TABLE_THEMES, DEFAULT_TABLE_THEME);
}

/**
 * Persists a valid table theme ID to localStorage.
 * @param {string} id
 */
export function setStoredTableTheme(id) {
  writeStoredTheme(TABLE_THEME_STORAGE_KEY, TABLE_THEMES, id);
}
