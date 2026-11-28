import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { createAuthRouter, parseCookies, SESSION_COOKIE_NAME } from './authRoutes.mjs';
import { createDatabase } from './db.mjs';

function requestJson(baseUrl, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload =
      body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const reqHeaders = { ...headers };
    if (payload !== null && !reqHeaders['content-type']) {
      reqHeaders['content-type'] = 'application/json';
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            raw,
          });
        });
      },
    );

    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

function extractCookieValue(setCookieHeaders, cookieName) {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
    ? [setCookieHeaders]
    : [];
  for (const header of list) {
    const [pair] = header.split(';');
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0 && pair.slice(0, eqIndex).trim() === cookieName) {
      return {
        value: decodeURIComponent(pair.slice(eqIndex + 1).trim()),
        rawHeader: header,
      };
    }
  }
  return null;
}

describe('server/authRoutes', () => {
  it('parses Cookie headers safely', () => {
    assert.deepEqual(parseCookies(undefined), {});
    assert.deepEqual(parseCookies(''), {});
    assert.deepEqual(parseCookies('foo=bar; meo_no_session=abc%2B123; empty='), {
      foo: 'bar',
      meo_no_session: 'abc+123',
      empty: '',
    });
    assert.deepEqual(parseCookies('broken=%E0%A4%A; ok=yes'), {
      broken: '%E0%A4%A',
      ok: 'yes',
    });
  });

  describe('Express API integration', () => {
    let db;
    let server;
    let baseUrl;

    before(async () => {
      db = createDatabase(':memory:');
      const app = express();
      app.use(createAuthRouter({ db, isProd: true }));

      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    after(async () => {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      db.close();
    });

    it('handles unauthenticated /api/auth/me and /api/profile/preferences', async () => {
      const meRes = await requestJson(baseUrl, { method: 'GET', path: '/api/auth/me' });
      assert.equal(meRes.status, 200);
      assert.deepEqual(meRes.json, { ok: true, user: null });

      const prefRes = await requestJson(baseUrl, {
        method: 'PATCH',
        path: '/api/profile/preferences',
        body: { locale: 'en' },
      });
      assert.equal(prefRes.status, 401);
      assert.equal(prefRes.json.ok, false);
      assert.equal(prefRes.json.code, 'UNAUTHORIZED');
    });

    it('registers a user, sets HttpOnly cookie (Secure only on HTTPS), and validates errors', async () => {
      const badJsonRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/register',
        body: '{not-valid-json',
      });
      assert.equal(badJsonRes.status, 400);
      assert.equal(badJsonRes.json.ok, false);
      assert.equal(badJsonRes.json.code, 'INVALID_JSON');

      const regRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/register',
        body: {
          username: 'KittenHost',
          password: 'password123',
          displayName: 'Host',
        },
      });

      assert.equal(regRes.status, 201);
      assert.equal(regRes.json.ok, true);
      assert.equal(regRes.json.user.username, 'KittenHost');
      assert.equal(regRes.json.user.displayName, 'Host');
      assert.ok(regRes.json.token);

      const cookieInfo = extractCookieValue(regRes.headers['set-cookie'], SESSION_COOKIE_NAME);
      assert.ok(cookieInfo);
      assert.equal(cookieInfo.value, regRes.json.token);
      assert.match(cookieInfo.rawHeader, /HttpOnly/i);
      assert.match(cookieInfo.rawHeader, /Path=\//i);
      assert.match(cookieInfo.rawHeader, /SameSite=Lax/i);
      assert.doesNotMatch(cookieInfo.rawHeader, /;\s*Secure/i);

      const dupRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/register',
        body: { username: 'kittenhost', password: 'password123' },
      });
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.json.ok, false);
      assert.equal(dupRes.json.code, 'USERNAME_TAKEN');

      const invalidRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/register',
        body: { username: 'x', password: '123' },
      });
      assert.equal(invalidRes.status, 400);
      assert.equal(invalidRes.json.ok, false);
      assert.equal(invalidRes.json.code, 'USERNAME_INVALID');
    });

    it('adds Secure flag when x-forwarded-proto is https', async () => {
      const regRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/register',
        headers: { 'x-forwarded-proto': 'https' },
        body: { username: 'HttpsUser', password: 'password123' },
      });
      assert.equal(regRes.status, 201);
      const cookieInfo = extractCookieValue(regRes.headers['set-cookie'], SESSION_COOKIE_NAME);
      assert.ok(cookieInfo);
      assert.match(cookieInfo.rawHeader, /;\s*Secure/i);
    });

    it('supports login, Bearer and cookie auth on /me and /profile/preferences, and logout', async () => {
      const badLogin = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'KittenHost', password: 'wrongpassword' },
      });
      assert.equal(badLogin.status, 401);
      assert.equal(badLogin.json.ok, false);
      assert.equal(badLogin.json.code, 'INVALID_CREDENTIALS');

      const loginRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'kittenhost', password: 'password123' },
      });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.json.ok, true);
      const token = loginRes.json.token;
      const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

      const meCookieRes = await requestJson(baseUrl, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { cookie: cookieHeader },
      });
      assert.equal(meCookieRes.status, 200);
      assert.equal(meCookieRes.json.user.username, 'KittenHost');

      const meBearerRes = await requestJson(baseUrl, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(meBearerRes.status, 200);
      assert.equal(meBearerRes.json.user.username, 'KittenHost');

      const badPrefRes = await requestJson(baseUrl, {
        method: 'PATCH',
        path: '/api/profile/preferences',
        headers: { authorization: `Bearer ${token}` },
        body: { tableTheme: 'neon-red' },
      });
      assert.equal(badPrefRes.status, 400);
      assert.equal(badPrefRes.json.ok, false);
      assert.equal(badPrefRes.json.code, 'INVALID_PREFERENCES');

      const prefRes = await requestJson(baseUrl, {
        method: 'PATCH',
        path: '/api/profile/preferences',
        headers: { cookie: cookieHeader },
        body: {
          displayName: 'MeoBoss',
          cardTheme: 'deck2',
          tableTheme: 'pastel-blue',
          locale: 'en',
        },
      });
      assert.equal(prefRes.status, 200);
      assert.equal(prefRes.json.ok, true);
      assert.equal(prefRes.json.user.displayName, 'MeoBoss');
      assert.equal(prefRes.json.user.cardTheme, 'deck2');
      assert.equal(prefRes.json.user.tableTheme, 'pastel-blue');
      assert.equal(prefRes.json.user.locale, 'en');

      const logoutRes = await requestJson(baseUrl, {
        method: 'POST',
        path: '/api/auth/logout',
        headers: { cookie: cookieHeader },
      });
      assert.equal(logoutRes.status, 200);
      assert.deepEqual(logoutRes.json, { ok: true });
      const clearedCookie = extractCookieValue(logoutRes.headers['set-cookie'], SESSION_COOKIE_NAME);
      assert.ok(clearedCookie);
      assert.match(clearedCookie.rawHeader, /Max-Age=0/i);

      const meAfterLogout = await requestJson(baseUrl, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(meAfterLogout.status, 200);
      assert.deepEqual(meAfterLogout.json, { ok: true, user: null });
    });

    it('returns leaderboard from GET /api/leaderboard', async () => {
      const u1 = db.registerUser({ username: 'champ1', password: 'password123', displayName: 'Champ' }).user;
      const u2 = db.registerUser({ username: 'runner2', password: 'password123', displayName: 'Runner' }).user;

      db.recordMatchResult({
        roomCode: 'ROOM1',
        participantUserIds: [u1.id, u2.id],
        winnerUserId: u1.id,
        winnerName: 'Champ',
        playerCount: 2,
      });

      const lbRes = await requestJson(baseUrl, {
        method: 'GET',
        path: '/api/leaderboard?limit=5',
      });
      assert.equal(lbRes.status, 200);
      assert.equal(lbRes.json.ok, true);
      assert.equal(lbRes.json.leaderboard.length, 2);
      assert.deepEqual(lbRes.json.leaderboard[0], {
        id: u1.id,
        username: 'champ1',
        displayName: 'Champ',
        wins: 1,
        gamesPlayed: 1,
      });
    });
  });
});
