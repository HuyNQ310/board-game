import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const CARD_THEMES = Object.freeze(['deck1', 'deck2', 'deck3']);
export const TABLE_THEMES = Object.freeze([
  'pastel-yellow',
  'pastel-pink',
  'pastel-green',
  'pastel-blue',
]);
export const LOCALES = Object.freeze(['vi', 'en']);

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,20}$/;
const SCRYPT_KEY_LEN = 64;

/**
 * Structured error thrown by database auth and validation operations.
 */
export class DbAuthError extends Error {
  /**
   * @param {string} code - Machine-readable error code
   * @param {string} message - Human-readable fallback message
   * @param {number} [status=400] - HTTP status code
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'DbAuthError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Hashes a password with a 16-byte random salt using scrypt.
 *
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN);
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verifies a password against a `salt:hash` string using constant-time comparison.
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, hashHex] = parts;
  if (
    !salt ||
    !hashHex ||
    hashHex.length !== SCRYPT_KEY_LEN * 2 ||
    !/^[0-9a-f]+$/i.test(hashHex)
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== SCRYPT_KEY_LEN) {
      return false;
    }
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN);
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Generates a 32-byte URL-safe base64 session token.
 *
 * @returns {string}
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes the SHA-256 hex digest of a session token for database storage.
 *
 * @param {string} token
 * @returns {string}
 */
export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validateUsername(raw) {
  if (typeof raw !== 'string') {
    throw new DbAuthError('USERNAME_INVALID', 'Username must be 3-20 characters (letters, numbers, _, ., -)', 400);
  }
  const trimmed = raw.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new DbAuthError('USERNAME_INVALID', 'Username must be 3-20 characters (letters, numbers, _, ., -)', 400);
  }
  return trimmed;
}

function validateDisplayName(raw) {
  if (typeof raw !== 'string') {
    throw new DbAuthError('NAME_INVALID', 'Display name must be between 1 and 16 characters', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    throw new DbAuthError('NAME_INVALID', 'Display name must be between 1 and 16 characters', 400);
  }
  return trimmed;
}

function validatePassword(raw) {
  if (typeof raw !== 'string' || raw.length < 6 || raw.length > 128) {
    throw new DbAuthError('PASSWORD_INVALID', 'Password must be between 6 and 128 characters', 400);
  }
  return raw;
}

function validateEnum(value, allowed, fieldName) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new DbAuthError('INVALID_PREFERENCES', `Invalid ${fieldName}`, 400);
  }
  return value;
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    cardTheme: row.card_theme,
    tableTheme: row.table_theme,
    locale: row.locale,
    gamesPlayed: row.games_played,
    wins: row.wins,
    createdAt: row.created_at,
  };
}

/**
 * Creates and initializes the SQLite database layer for Mèo Nổ.
 *
 * @param {string} [dbPath]
 * @param {{ now?: () => number }} [options]
 */
export function createDatabase(
  dbPath = process.env.DB_PATH || './data/meo-no.sqlite',
  { now = () => Date.now() } = {},
) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new DatabaseSync(dbPath);

  try {
    sqlite.exec('PRAGMA busy_timeout = 3000;');
    sqlite.exec('PRAGMA journal_mode = WAL;');
  } catch {
    // In-memory databases may not support WAL mode.
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      card_theme TEXT NOT NULL DEFAULT 'deck1',
      table_theme TEXT NOT NULL DEFAULT 'pastel-green',
      locale TEXT NOT NULL DEFAULT 'vi',
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      winner_user_id TEXT,
      winner_name TEXT,
      player_count INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_leaderboard ON users(wins DESC, games_played ASC, updated_at DESC);
  `);

  const stmtInsertUser = sqlite.prepare(`
    INSERT INTO users (
      id, username, display_name, password_hash,
      card_theme, table_theme, locale,
      games_played, wins, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `);
  const stmtFindUserByUsername = sqlite.prepare(`
    SELECT id, username, display_name, password_hash, card_theme, table_theme, locale, games_played, wins, created_at, updated_at
    FROM users
    WHERE username = ?
  `);
  const stmtFindUserById = sqlite.prepare(`
    SELECT id, username, display_name, card_theme, table_theme, locale, games_played, wins, created_at, updated_at
    FROM users
    WHERE id = ?
  `);
  const stmtInsertSession = sqlite.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const stmtFindSessionUser = sqlite.prepare(`
    SELECT
      s.expires_at,
      u.id, u.username, u.display_name, u.card_theme, u.table_theme, u.locale,
      u.games_played, u.wins, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `);
  const stmtDeleteSession = sqlite.prepare(`
    DELETE FROM sessions WHERE token_hash = ?
  `);
  const stmtUpdatePreferences = sqlite.prepare(`
    UPDATE users
    SET display_name = ?, card_theme = ?, table_theme = ?, locale = ?, updated_at = ?
    WHERE id = ?
  `);
  const stmtInsertMatch = sqlite.prepare(`
    INSERT INTO matches (id, room_code, winner_user_id, winner_name, player_count, finished_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const stmtIncrementGamesPlayed = sqlite.prepare(`
    UPDATE users SET games_played = games_played + 1, updated_at = ? WHERE id = ?
  `);
  const stmtIncrementWins = sqlite.prepare(`
    UPDATE users SET wins = wins + 1, updated_at = ? WHERE id = ?
  `);
  const stmtLeaderboard = sqlite.prepare(`
    SELECT id, username, display_name, wins, games_played
    FROM users
    WHERE games_played > 0
    ORDER BY wins DESC, games_played ASC, updated_at DESC
    LIMIT ?
  `);

  function createSession(userId, timestamp) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    stmtInsertSession.run(tokenHash, userId, timestamp + SESSION_TTL_MS, timestamp);
    return token;
  }

  function runInTransaction(fn) {
    sqlite.exec('BEGIN');
    try {
      const result = fn();
      sqlite.exec('COMMIT');
      return result;
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  function registerUser({
    username,
    password,
    displayName,
    cardTheme = 'deck1',
    tableTheme = 'pastel-green',
    locale = 'vi',
  } = {}) {
    const validUsername = validateUsername(username);
    const validPassword = validatePassword(password);
    const validDisplayName =
      displayName === undefined || displayName === null
        ? validUsername.slice(0, 16)
        : validateDisplayName(displayName);
    const validCardTheme = validateEnum(cardTheme, CARD_THEMES, 'cardTheme');
    const validTableTheme = validateEnum(tableTheme, TABLE_THEMES, 'tableTheme');
    const validLocale = validateEnum(locale, LOCALES, 'locale');

    const existing = stmtFindUserByUsername.get(validUsername);
    if (existing) {
      throw new DbAuthError('USERNAME_TAKEN', 'Username is already taken', 409);
    }

    const timestamp = now();
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(validPassword);

    try {
      return runInTransaction(() => {
        stmtInsertUser.run(
          id,
          validUsername,
          validDisplayName,
          passwordHash,
          validCardTheme,
          validTableTheme,
          validLocale,
          timestamp,
          timestamp,
        );
        const token = createSession(id, timestamp);
        const created = stmtFindUserById.get(id);
        return { user: sanitizeUser(created), token };
      });
    } catch (err) {
      if (err instanceof DbAuthError) throw err;
      if (String(err?.message || '').toUpperCase().includes('UNIQUE')) {
        throw new DbAuthError('USERNAME_TAKEN', 'Username is already taken', 409);
      }
      throw err;
    }
  }

  function loginUser({ username, password } = {}) {
    if (typeof username !== 'string' || !username.trim()) {
      throw new DbAuthError('USERNAME_INVALID', 'Username is required', 400);
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new DbAuthError('PASSWORD_INVALID', 'Password is required', 400);
    }

    const trimmedUsername = username.trim();
    const row = stmtFindUserByUsername.get(trimmedUsername);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new DbAuthError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    const token = createSession(row.id, now());
    return { user: sanitizeUser(row), token };
  }

  function getUserByToken(token) {
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }
    const tokenHash = hashSessionToken(token.trim());
    const row = stmtFindSessionUser.get(tokenHash);
    if (!row) {
      return null;
    }
    if (row.expires_at <= now()) {
      stmtDeleteSession.run(tokenHash);
      return null;
    }
    return sanitizeUser(row);
  }

  function logoutSession(token) {
    if (typeof token !== 'string' || !token.trim()) {
      return;
    }
    stmtDeleteSession.run(hashSessionToken(token.trim()));
  }

  function updateUserPreferences(
    userId,
    { displayName, cardTheme, tableTheme, locale } = {},
  ) {
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new DbAuthError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const current = stmtFindUserById.get(userId);
    if (!current) {
      throw new DbAuthError('UNAUTHORIZED', 'User not found', 401);
    }

    const nextDisplayName =
      displayName !== undefined ? validateDisplayName(displayName) : current.display_name;
    const nextCardTheme =
      cardTheme !== undefined ? validateEnum(cardTheme, CARD_THEMES, 'cardTheme') : current.card_theme;
    const nextTableTheme =
      tableTheme !== undefined
        ? validateEnum(tableTheme, TABLE_THEMES, 'tableTheme')
        : current.table_theme;
    const nextLocale =
      locale !== undefined ? validateEnum(locale, LOCALES, 'locale') : current.locale;

    const timestamp = now();
    stmtUpdatePreferences.run(
      nextDisplayName,
      nextCardTheme,
      nextTableTheme,
      nextLocale,
      timestamp,
      userId,
    );

    return sanitizeUser(stmtFindUserById.get(userId));
  }

  function recordMatchResult({
    roomCode,
    participantUserIds = [],
    winnerUserId = null,
    winnerName = '',
    playerCount = 0,
  } = {}) {
    const timestamp = now();
    const id = crypto.randomUUID();
    const normalizedRoomCode = typeof roomCode === 'string' ? roomCode.trim() : '';
    const normalizedWinnerId =
      typeof winnerUserId === 'string' && winnerUserId.trim() ? winnerUserId.trim() : null;
    const normalizedWinnerName = typeof winnerName === 'string' ? winnerName : '';
    const normalizedPlayerCount = Number.isFinite(Number(playerCount))
      ? Math.max(0, Math.trunc(Number(playerCount)))
      : 0;

    const uniqueParticipants = Array.from(
      new Set(
        (Array.isArray(participantUserIds) ? participantUserIds : []).filter(
          (uid) => typeof uid === 'string' && uid.trim().length > 0,
        ),
      ),
    );

    runInTransaction(() => {
      stmtInsertMatch.run(
        id,
        normalizedRoomCode,
        normalizedWinnerId,
        normalizedWinnerName,
        normalizedPlayerCount,
        timestamp,
      );

      for (const uid of uniqueParticipants) {
        stmtIncrementGamesPlayed.run(timestamp, uid);
      }

      if (normalizedWinnerId) {
        stmtIncrementWins.run(timestamp, normalizedWinnerId);
      }
    });

    return {
      id,
      roomCode: normalizedRoomCode,
      winnerUserId: normalizedWinnerId,
      winnerName: normalizedWinnerName,
      playerCount: normalizedPlayerCount,
      finishedAt: timestamp,
    };
  }

  function getLeaderboard(limit = 10) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 10;

    return stmtLeaderboard.all(safeLimit).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      wins: row.wins,
      gamesPlayed: row.games_played,
    }));
  }

  function close() {
    sqlite.close();
  }

  return {
    registerUser,
    loginUser,
    getUserByToken,
    logoutSession,
    updateUserPreferences,
    recordMatchResult,
    getLeaderboard,
    close,
  };
}
