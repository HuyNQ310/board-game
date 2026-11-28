import express from 'express';

export const SESSION_COOKIE_NAME = 'meo_no_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Parses an HTTP Cookie header into a plain key-value object.
 *
 * @param {string | undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

function isHttpsRequest(req) {
  if (req.secure) return true;
  const forwardedProto = req.headers?.['x-forwarded-proto'];
  if (typeof forwardedProto !== 'string') return false;
  return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
}

function buildSessionCookie(value, { secure, maxAge }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function extractSessionToken(req) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const cookies = parseCookies(req.headers?.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Creates the Express router for auth, profile preferences, and leaderboard endpoints.
 *
 * @param {{ db: ReturnType<import('./db.mjs').createDatabase>, isProd?: boolean }} options
 * @returns {import('express').Router}
 */
export function createAuthRouter({ db, isProd = process.env.NODE_ENV === 'production' }) {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));

  router.post('/api/auth/register', (req, res, next) => {
    try {
      const { username, password, displayName, cardTheme, tableTheme, locale } = req.body || {};
      const { user, token } = db.registerUser({
        username,
        password,
        displayName,
        cardTheme,
        tableTheme,
        locale,
      });

      res.append(
        'Set-Cookie',
        buildSessionCookie(token, {
          secure: isHttpsRequest(req),
          maxAge: SESSION_MAX_AGE_SECONDS,
        }),
      );
      res.status(201).json({ ok: true, user, token });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/auth/login', (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const { user, token } = db.loginUser({ username, password });

      res.append(
        'Set-Cookie',
        buildSessionCookie(token, {
          secure: isHttpsRequest(req),
          maxAge: SESSION_MAX_AGE_SECONDS,
        }),
      );
      res.status(200).json({ ok: true, user, token });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/auth/logout', (req, res, next) => {
    try {
      const token = extractSessionToken(req);
      if (token) {
        db.logoutSession(token);
      }

      res.append(
        'Set-Cookie',
        buildSessionCookie('', {
          secure: isHttpsRequest(req),
          maxAge: 0,
        }),
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/auth/me', (req, res, next) => {
    try {
      const token = extractSessionToken(req);
      const user = token ? db.getUserByToken(token) : null;
      res.status(200).json({ ok: true, user });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/api/profile/preferences', (req, res, next) => {
    try {
      const token = extractSessionToken(req);
      const currentUser = token ? db.getUserByToken(token) : null;
      if (!currentUser) {
        res.status(401).json({
          ok: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const { displayName, cardTheme, tableTheme, locale } = req.body || {};
      const user = db.updateUserPreferences(currentUser.id, {
        displayName,
        cardTheme,
        tableTheme,
        locale,
      });
      res.status(200).json({ ok: true, user });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/leaderboard', (req, res, next) => {
    try {
      const leaderboard = db.getLeaderboard(req.query?.limit);
      res.status(200).json({ ok: true, leaderboard });
    } catch (err) {
      next(err);
    }
  });

  router.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && err.status === 400) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_JSON',
        message: 'Invalid JSON body',
      });
      return;
    }

    if (err && typeof err.status === 'number' && typeof err.code === 'string') {
      res.status(err.status).json({
        ok: false,
        code: err.code,
        message: err.message,
      });
      return;
    }

    console.error('[authRoutes] Unexpected error:', err);
    res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: isProd ? 'Internal server error' : err?.message || 'Internal server error',
    });
  });

  return router;
}
