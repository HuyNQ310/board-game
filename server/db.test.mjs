import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  createDatabase,
  DbAuthError,
  hashPassword,
  SESSION_TTL_MS,
  verifyPassword,
} from './db.mjs';

describe('server/db', () => {
  it('hashes and verifies passwords with unique random salts', () => {
    const h1 = hashPassword('secret123');
    const h2 = hashPassword('secret123');

    assert.notEqual(h1, h2);
    assert.match(h1, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(verifyPassword('secret123', h1), true);
    assert.equal(verifyPassword('wrongpass', h1), false);
    assert.equal(verifyPassword('secret123', 'malformed'), false);
    assert.equal(verifyPassword('secret123', 'abcd:zzzz'), false);
  });

  it('creates parent directory for file-backed SQLite database', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'meo-no-db-'));
    const dbPath = path.join(tmpRoot, 'nested', 'dir', 'test.sqlite');

    const db = createDatabase(dbPath);
    try {
      const { user, token } = db.registerUser({ username: 'fileuser', password: 'password123' });
      assert.equal(user.username, 'fileuser');
      assert.ok(token);
      assert.equal(fs.existsSync(dbPath), true);
    } finally {
      db.close();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('registers users with defaults, validates fields, and rejects case-insensitive duplicates', () => {
    const db = createDatabase(':memory:');
    try {
      const { user, token } = db.registerUser({
        username: '  Meo_No.1  ',
        password: 'password123',
      });

      assert.equal(user.username, 'Meo_No.1');
      assert.equal(user.displayName, 'Meo_No.1');
      assert.equal(user.cardTheme, 'deck1');
      assert.equal(user.tableTheme, 'pastel-green');
      assert.equal(user.locale, 'vi');
      assert.equal(user.gamesPlayed, 0);
      assert.equal(user.wins, 0);
      assert.equal('passwordHash' in user, false);
      assert.equal('password_hash' in user, false);
      assert.ok(typeof token === 'string' && token.length >= 32);

      assert.throws(
        () => db.registerUser({ username: 'meo_no.1', password: 'password123' }),
        (err) => err instanceof DbAuthError && err.code === 'USERNAME_TAKEN' && err.status === 409,
      );

      assert.throws(
        () => db.registerUser({ username: 'ab', password: 'password123' }),
        (err) => err instanceof DbAuthError && err.code === 'USERNAME_INVALID' && err.status === 400,
      );

      assert.throws(
        () => db.registerUser({ username: 'bad user!', password: 'password123' }),
        (err) => err instanceof DbAuthError && err.code === 'USERNAME_INVALID' && err.status === 400,
      );

      assert.throws(
        () => db.registerUser({ username: 'valid_user', password: '123' }),
        (err) => err instanceof DbAuthError && err.code === 'PASSWORD_INVALID' && err.status === 400,
      );

      assert.throws(
        () => db.registerUser({ username: 'valid_user', password: 'password123', displayName: '   ' }),
        (err) => err instanceof DbAuthError && err.code === 'NAME_INVALID' && err.status === 400,
      );

      assert.throws(
        () => db.registerUser({
          username: 'valid_user',
          password: 'password123',
          displayName: '12345678901234567',
        }),
        (err) => err instanceof DbAuthError && err.code === 'NAME_INVALID' && err.status === 400,
      );

      assert.throws(
        () => db.registerUser({
          username: 'valid_user',
          password: 'password123',
          cardTheme: 'deck99',
        }),
        (err) => err instanceof DbAuthError && err.code === 'INVALID_PREFERENCES' && err.status === 400,
      );
    } finally {
      db.close();
    }
  });

  it('logs in users, resolves tokens, expires sessions, and logs out', () => {
    let currentTime = 1_700_000_000_000;
    const db = createDatabase(':memory:', { now: () => currentTime });
    try {
      db.registerUser({
        username: 'Alice_99',
        password: 'supersecret',
        displayName: 'Alice',
        cardTheme: 'deck2',
        tableTheme: 'pastel-pink',
        locale: 'en',
      });

      assert.throws(
        () => db.loginUser({ username: 'alice_99', password: 'wrong' }),
        (err) => err instanceof DbAuthError && err.code === 'INVALID_CREDENTIALS' && err.status === 401,
      );

      assert.throws(
        () => db.loginUser({ username: 'nobody', password: 'supersecret' }),
        (err) => err instanceof DbAuthError && err.code === 'INVALID_CREDENTIALS' && err.status === 401,
      );

      assert.throws(
        () => db.loginUser({ username: '', password: 'supersecret' }),
        (err) => err instanceof DbAuthError && err.code === 'USERNAME_INVALID' && err.status === 400,
      );

      const { user, token } = db.loginUser({ username: 'alice_99', password: 'supersecret' });
      assert.equal(user.username, 'Alice_99');
      assert.equal(user.displayName, 'Alice');
      assert.equal(user.cardTheme, 'deck2');
      assert.equal(user.tableTheme, 'pastel-pink');
      assert.equal(user.locale, 'en');

      const fetched = db.getUserByToken(token);
      assert.deepEqual(fetched, user);
      assert.equal(db.getUserByToken('non-existent-token'), null);
      assert.equal(db.getUserByToken(''), null);

      db.logoutSession(token);
      assert.equal(db.getUserByToken(token), null);

      const { token: token2 } = db.loginUser({ username: 'Alice_99', password: 'supersecret' });
      assert.ok(db.getUserByToken(token2));

      currentTime += SESSION_TTL_MS + 1;
      assert.equal(db.getUserByToken(token2), null);
    } finally {
      db.close();
    }
  });

  it('updates user preferences partially and validates inputs', () => {
    const db = createDatabase(':memory:');
    try {
      const { user } = db.registerUser({
        username: 'bob_cat',
        password: 'password123',
      });

      const updated = db.updateUserPreferences(user.id, {
        displayName: '  Bobby  ',
        cardTheme: 'deck3',
        tableTheme: 'pastel-blue',
        locale: 'en',
      });

      assert.equal(updated.displayName, 'Bobby');
      assert.equal(updated.cardTheme, 'deck3');
      assert.equal(updated.tableTheme, 'pastel-blue');
      assert.equal(updated.locale, 'en');

      const partial = db.updateUserPreferences(user.id, {
        tableTheme: 'pastel-yellow',
      });
      assert.equal(partial.displayName, 'Bobby');
      assert.equal(partial.cardTheme, 'deck3');
      assert.equal(partial.tableTheme, 'pastel-yellow');
      assert.equal(partial.locale, 'en');

      assert.throws(
        () => db.updateUserPreferences('missing-id', { locale: 'vi' }),
        (err) => err instanceof DbAuthError && err.code === 'UNAUTHORIZED' && err.status === 401,
      );

      assert.throws(
        () => db.updateUserPreferences(user.id, { locale: 'fr' }),
        (err) => err instanceof DbAuthError && err.code === 'INVALID_PREFERENCES' && err.status === 400,
      );
    } finally {
      db.close();
    }
  });

  it('records match results and ranks leaderboard correctly', () => {
    let currentTime = 1_700_000_000_000;
    const db = createDatabase(':memory:', { now: () => currentTime });
    try {
      const u1 = db.registerUser({ username: 'player1', password: 'password123', displayName: 'P1' }).user;
      const u2 = db.registerUser({ username: 'player2', password: 'password123', displayName: 'P2' }).user;
      const u3 = db.registerUser({ username: 'player3', password: 'password123', displayName: 'P3' }).user;
      db.registerUser({ username: 'idle_player', password: 'password123', displayName: 'Idle' });

      currentTime += 1000;
      const match1 = db.recordMatchResult({
        roomCode: 'ABCD',
        participantUserIds: [u1.id, u2.id, u1.id],
        winnerUserId: u1.id,
        winnerName: 'P1',
        playerCount: 3,
      });
      assert.equal(match1.roomCode, 'ABCD');
      assert.equal(match1.winnerUserId, u1.id);
      assert.equal(match1.playerCount, 3);

      currentTime += 1000;
      db.recordMatchResult({
        roomCode: 'EFGH',
        participantUserIds: [u2.id, u3.id],
        winnerUserId: u2.id,
        winnerName: 'P2',
        playerCount: 2,
      });

      currentTime += 1000;
      db.recordMatchResult({
        roomCode: 'IJKL',
        participantUserIds: [u2.id, u3.id],
        winnerUserId: null,
        winnerName: 'GuestWinner',
        playerCount: 2,
      });

      const leaderboard = db.getLeaderboard(10);
      // u1: 1 win, 1 game; u2: 1 win, 3 games; u3: 0 wins, 2 games; idle_player excluded (0 games)
      assert.deepEqual(leaderboard, [
        { id: u1.id, username: 'player1', displayName: 'P1', wins: 1, gamesPlayed: 1 },
        { id: u2.id, username: 'player2', displayName: 'P2', wins: 1, gamesPlayed: 3 },
        { id: u3.id, username: 'player3', displayName: 'P3', wins: 0, gamesPlayed: 2 },
      ]);

      const limited = db.getLeaderboard(2);
      assert.equal(limited.length, 2);
      assert.equal(limited[0].id, u1.id);
      assert.equal(limited[1].id, u2.id);
    } finally {
      db.close();
    }
  });
});
