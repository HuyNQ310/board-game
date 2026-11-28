import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CLIENT_DIST_DIR = path.resolve(__dirname, '../client/dist');
const DEFAULT_CLIENT_PUBLIC_DIR = path.resolve(__dirname, '../client/public');

const EN_TITLE = 'Exploding Kittens Online — 2–10 Player Survival Card Game';
const EN_DESCRIPTION =
  'Play Exploding Kittens Online (Mèo Nổ) free with 2–10 players in your browser: 12 strategic card types, zero-leak 5-second Nope window, WebRTC voice chat, and realtime room chat.';
const EN_OG_DESCRIPTION =
  'Create a 5-character room code, play 12 cards with a 5s Nope window, WebRTC voice chat, and per-player mute controls. No download required.';

/**
 * Resolves the canonical public base URL without a trailing slash.
 * Prefers a configured PUBLIC_URL environment value and falls back to the request host.
 *
 * @param {import('express').Request} req
 * @param {string} [envPublicUrl=process.env.PUBLIC_URL]
 * @returns {string}
 */
export function resolvePublicBaseUrl(req, envPublicUrl = process.env.PUBLIC_URL) {
  if (typeof envPublicUrl === 'string' && envPublicUrl.trim().length > 0) {
    return envPublicUrl.trim().replace(/\/+$/, '');
  }

  const protocol = req?.protocol || 'http';
  const host =
    (typeof req?.get === 'function' ? req.get('host') : req?.headers?.host) || 'localhost';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

/**
 * Escapes special XML characters in URLs or text nodes.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapes HTML attribute values safely.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Reads the first readable file from an ordered list of candidate paths.
 *
 * @param {string[]} candidates
 * @returns {Promise<string|null>}
 */
async function readFirstExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * Replaces an existing tag matching `pattern` or injects `fallbackTag` before `</head>`.
 *
 * @param {string} html
 * @param {RegExp} pattern
 * @param {string} replacement
 * @param {string} [fallbackTag=replacement]
 * @returns {string}
 */
function upsertHeadTag(html, pattern, replacement, fallbackTag = replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace(/<\/head>/i, `    ${fallbackTag}\n  </head>`);
}

/**
 * Localizes the SPA index HTML document for the `/en` entry route.
 *
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string}
 */
function localizeIndexHtmlForEnglish(html, baseUrl) {
  const canonicalUrl = escapeHtmlAttr(`${baseUrl}/en`);
  let output = html;

  if (/<html\b[^>]*\blang=["'][^"']*["'][^>]*>/i.test(output)) {
    output = output.replace(
      /(<html\b[^>]*\blang=)(["'])[^"']*\2/i,
      '$1$2en$2'
    );
  } else {
    output = output.replace(/<html\b/i, '<html lang="en"');
  }

  output = upsertHeadTag(
    output,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${EN_TITLE}</title>`
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bname=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtmlAttr(EN_DESCRIPTION)}" />`
  );
  output = upsertHeadTag(
    output,
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bproperty=["']og:locale["'][^>]*>/i,
    '<meta property="og:locale" content="en_US" />'
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bproperty=["']og:locale:alternate["'][^>]*>/i,
    '<meta property="og:locale:alternate" content="vi_VN" />'
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(EN_TITLE)}" />`
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bproperty=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(EN_OG_DESCRIPTION)}" />`
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bname=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(EN_TITLE)}" />`
  );
  output = upsertHeadTag(
    output,
    /<meta\b[^>]*\bname=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttr(EN_OG_DESCRIPTION)}" />`
  );

  return output;
}

/**
 * Builds the `robots.txt` payload welcoming major search & AI crawlers.
 *
 * @param {string} baseUrl
 * @returns {string}
 */
function buildRobotsTxt(baseUrl) {
  const bots = [
    'Googlebot',
    'Bingbot',
    'OAI-SearchBot',
    'GPTBot',
    'PerplexityBot',
    'ClaudeBot',
    'Applebot-Extended',
    '*',
  ];

  const blocks = bots.map((agent) =>
    [
      `User-agent: ${agent}`,
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /socket.io/',
    ].join('\n')
  );

  return `${blocks.join('\n\n')}\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
}

/**
 * Builds the XML sitemap with hreflang alternates for Vietnamese & English pages.
 *
 * @param {string} baseUrl
 * @returns {string}
 */
function buildSitemapXml(baseUrl) {
  const homeGroup = [
    { hreflang: 'vi', href: `${baseUrl}/` },
    { hreflang: 'en', href: `${baseUrl}/en` },
    { hreflang: 'x-default', href: `${baseUrl}/` },
  ];
  const rulesGroup = [
    { hreflang: 'vi', href: `${baseUrl}/luat-choi` },
    { hreflang: 'en', href: `${baseUrl}/en/rules` },
    { hreflang: 'x-default', href: `${baseUrl}/luat-choi` },
  ];

  const entries = [
    { path: '/', priority: '1.0', changefreq: 'weekly', alternates: homeGroup },
    { path: '/en', priority: '0.9', changefreq: 'weekly', alternates: homeGroup },
    { path: '/luat-choi', priority: '0.9', changefreq: 'monthly', alternates: rulesGroup },
    { path: '/en/rules', priority: '0.9', changefreq: 'monthly', alternates: rulesGroup },
  ];

  const urlsXml = entries
    .map((entry) => {
      const linksXml = entry.alternates
        .map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`
        )
        .join('\n');
      return [
        '  <url>',
        `    <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        linksXml,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urlsXml,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Creates an Express router serving SEO & GEO endpoints (`/robots.txt`, `/sitemap.xml`,
 * `/llms.txt`, `/luat-choi`, `/en/rules`, `/en`) and applying `X-Robots-Tag: noindex, nofollow`
 * on ephemeral room-invite query URLs.
 *
 * @param {object} [options]
 * @param {string} [options.clientDistDir]
 * @param {string} [options.clientPublicDir]
 * @returns {import('express').Router}
 */
export function createSeoRouter({
  clientDistDir = DEFAULT_CLIENT_DIST_DIR,
  clientPublicDir = DEFAULT_CLIENT_PUBLIC_DIR,
} = {}) {
  const router = express.Router();

  const publicFileCandidates = (filename) =>
    [
      clientDistDir ? path.join(clientDistDir, filename) : null,
      clientPublicDir ? path.join(clientPublicDir, filename) : null,
    ].filter(Boolean);

  const indexHtmlCandidates = () =>
    [
      clientDistDir ? path.join(clientDistDir, 'index.html') : null,
      clientPublicDir ? path.join(clientPublicDir, 'index.html') : null,
      clientPublicDir ? path.resolve(clientPublicDir, '..', 'index.html') : null,
      clientDistDir ? path.resolve(clientDistDir, '..', 'index.html') : null,
    ].filter(Boolean);

  router.get('/', (req, res, next) => {
    if (req.query?.room || req.query?.code) {
      res.set('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });

  router.get('/robots.txt', (req, res) => {
    const baseUrl = resolvePublicBaseUrl(req);
    res.type('text/plain; charset=utf-8').send(buildRobotsTxt(baseUrl));
  });

  router.get('/sitemap.xml', (req, res) => {
    const baseUrl = resolvePublicBaseUrl(req);
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(buildSitemapXml(baseUrl));
  });

  router.get('/llms.txt', async (req, res, next) => {
    try {
      const content = await readFirstExisting(publicFileCandidates('llms.txt'));
      if (content === null) {
        res.status(404).type('text/plain; charset=utf-8').send('llms.txt not found');
        return;
      }
      res.type('text/plain; charset=utf-8').send(content);
    } catch (err) {
      next(err);
    }
  });

  router.get('/luat-choi', async (req, res, next) => {
    try {
      const html = await readFirstExisting(publicFileCandidates('luat-choi.html'));
      if (html === null) {
        res.status(404).type('text/plain; charset=utf-8').send('luat-choi.html not found');
        return;
      }
      res.type('text/html; charset=utf-8').send(html);
    } catch (err) {
      next(err);
    }
  });

  router.get('/en/rules', async (req, res, next) => {
    try {
      const html = await readFirstExisting(publicFileCandidates('en-rules.html'));
      if (html === null) {
        res.status(404).type('text/plain; charset=utf-8').send('en-rules.html not found');
        return;
      }
      res.type('text/html; charset=utf-8').send(html);
    } catch (err) {
      next(err);
    }
  });

  router.get('/en', async (req, res, next) => {
    try {
      if (req.query?.room || req.query?.code) {
        res.set('X-Robots-Tag', 'noindex, nofollow');
      }
      const html = await readFirstExisting(indexHtmlCandidates());
      if (html === null) {
        res.status(404).type('text/plain; charset=utf-8').send('index.html not found');
        return;
      }
      const baseUrl = resolvePublicBaseUrl(req);
      res.type('text/html; charset=utf-8').send(localizeIndexHtmlForEnglish(html, baseUrl));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createSeoRouter;
