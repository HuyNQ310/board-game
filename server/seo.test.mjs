import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { createSeoRouter, resolvePublicBaseUrl } from './seo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const realClientDir = path.join(repoRoot, 'client');
const realPublicDir = path.join(realClientDir, 'public');
const realDistDir = path.join(realClientDir, 'dist');

/**
 * Issues an HTTP GET request against a running Node HTTP server.
 *
 * @param {http.Server} srv
 * @param {string} urlPath
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: string }>}
 */
function httpGet(srv, urlPath) {
  return new Promise((resolve, reject) => {
    const addr = srv.address();
    const port = typeof addr === 'object' && addr ? addr.port : 80;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Starts an ephemeral Express server with the SEO router mounted before a dummy `/` handler.
 *
 * @param {object} [opts]
 * @returns {Promise<{ server: http.Server, port: number, close: () => Promise<void> }>}
 */
async function startTestApp(opts = {}) {
  const app = express();
  app.use(
    createSeoRouter({
      clientDistDir: opts.clientDistDir ?? realDistDir,
      clientPublicDir: opts.clientPublicDir ?? realPublicDir,
    })
  );
  app.get('/', (req, res) => {
    res.type('text/html; charset=utf-8').send('<html><body>home</body></html>');
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    server,
    port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Extracts and parses all `<script type="application/ld+json">` blocks from an HTML string.
 *
 * @param {string} html
 * @returns {object[]}
 */
function extractJsonLdBlocks(html) {
  const matches = [
    ...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  return matches.map((m) => JSON.parse(m[1]));
}

test('resolvePublicBaseUrl normalizes PUBLIC_URL and falls back to req protocol/host', () => {
  const mockReq = {
    protocol: 'https',
    get: (header) => (header.toLowerCase() === 'host' ? 'meono.example.com' : undefined),
  };

  assert.equal(
    resolvePublicBaseUrl(mockReq, 'https://play.meono.vn///'),
    'https://play.meono.vn'
  );
  assert.equal(resolvePublicBaseUrl(mockReq, '  https://play.meono.vn/ '), 'https://play.meono.vn');
  assert.equal(resolvePublicBaseUrl(mockReq, ''), 'https://meono.example.com');
  assert.equal(resolvePublicBaseUrl(mockReq, undefined), 'https://meono.example.com');
});

test('GET /robots.txt welcomes search & AI bots, disallows API/socket, and points to sitemap.xml', async () => {
  const originalPublicUrl = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = 'https://meono.app/';
  const appCtx = await startTestApp();

  try {
    const res = await httpGet(appCtx.server, '/robots.txt');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/plain/i);

    for (const bot of [
      'Googlebot',
      'Bingbot',
      'OAI-SearchBot',
      'GPTBot',
      'PerplexityBot',
      'ClaudeBot',
      'Applebot-Extended',
    ]) {
      assert.ok(res.body.includes(`User-agent: ${bot}`), `Missing bot: ${bot}`);
    }
    assert.ok(res.body.includes('Disallow: /api/'));
    assert.ok(res.body.includes('Disallow: /socket.io/'));
    assert.ok(res.body.includes('Sitemap: https://meono.app/sitemap.xml'));
  } finally {
    await appCtx.close();
    if (originalPublicUrl === undefined) {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  }
});

test('GET /sitemap.xml returns valid XML with all routes and hreflang alternates', async () => {
  const originalPublicUrl = process.env.PUBLIC_URL;
  delete process.env.PUBLIC_URL;
  const appCtx = await startTestApp();

  try {
    const res = await httpGet(appCtx.server, '/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /application\/xml/i);
    assert.ok(res.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(res.body.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));

    const expectedBase = `http://127.0.0.1:${appCtx.port}`;
    for (const routePath of ['/', '/en', '/luat-choi', '/en/rules']) {
      assert.ok(
        res.body.includes(`<loc>${expectedBase}${routePath}</loc>`),
        `Missing <loc> for ${routePath}`
      );
    }

    assert.ok(res.body.includes(`hreflang="vi" href="${expectedBase}/"`));
    assert.ok(res.body.includes(`hreflang="en" href="${expectedBase}/en"`));
    assert.ok(res.body.includes(`hreflang="x-default" href="${expectedBase}/"`));
    assert.ok(res.body.includes(`hreflang="vi" href="${expectedBase}/luat-choi"`));
    assert.ok(res.body.includes(`hreflang="en" href="${expectedBase}/en/rules"`));
    assert.ok(res.body.includes('</urlset>'));
  } finally {
    await appCtx.close();
    if (originalPublicUrl !== undefined) {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  }
});

test('GET /llms.txt serves GEO markdown specification with fallback from dist to public', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'meo-no-seo-'));
  const tmpDist = path.join(tmpRoot, 'dist');
  await fs.mkdir(tmpDist, { recursive: true });

  const appFallback = await startTestApp({
    clientDistDir: tmpDist,
    clientPublicDir: realPublicDir,
  });

  try {
    const res = await httpGet(appFallback.server, '/llms.txt');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/plain/i);
    assert.ok(res.body.includes('# Mèo Nổ Online'));
    assert.ok(res.body.includes('2–10 players'));
    assert.ok(res.body.includes('5-second'));
    assert.ok(res.body.includes('WebRTC'));
    assert.ok(res.body.includes('Mèo Khoai Tây'));
    assert.ok(res.body.includes('Hairy Potato Cat'));
    assert.ok(res.body.includes('/luat-choi'));
    assert.ok(res.body.includes('/en/rules'));
  } finally {
    await appFallback.close();
  }

  // Also verify dist takes priority when llms.txt exists in clientDistDir
  await fs.writeFile(path.join(tmpDist, 'llms.txt'), '# Dist Override\n', 'utf8');
  const appDist = await startTestApp({
    clientDistDir: tmpDist,
    clientPublicDir: realPublicDir,
  });

  try {
    const res = await httpGet(appDist.server, '/llms.txt');
    assert.equal(res.status, 200);
    assert.equal(res.body, '# Dist Override\n');
  } finally {
    await appDist.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('GET /luat-choi and GET /en/rules serve standalone HTML guides with JSON-LD and 12 cards', async () => {
  const appCtx = await startTestApp();

  try {
    const viRes = await httpGet(appCtx.server, '/luat-choi');
    assert.equal(viRes.status, 200);
    assert.match(viRes.headers['content-type'] || '', /text\/html/i);
    assert.ok(viRes.body.includes('<html lang="vi">'));
    assert.ok(viRes.body.includes('<link rel="canonical" href="/luat-choi" />'));
    assert.ok(viRes.body.includes('hreflang="en" href="/en/rules"'));
    assert.ok(viRes.body.includes('href="/"'));
    assert.ok(viRes.body.includes('Vào chơi ngay'));

    const viLd = extractJsonLdBlocks(viRes.body);
    assert.equal(viLd.length, 1);
    const viTypes = viLd[0]['@graph'].map((node) => node['@type']);
    assert.deepEqual(viTypes, ['Article', 'FAQPage']);

    for (const cardName of [
      'Mèo Bùm',
      'Kìm Cắt Dây',
      'Truy Đuổi',
      'Ngủ Trưa',
      'Đảo Chiều',
      'Xáo Trộn',
      'Nài Nỉ',
      'Mắt Thần',
      'KHÔNG!',
      'Mèo Vằn',
      'Mèo Taco',
      'Mèo Khoai Tây',
    ]) {
      assert.ok(viRes.body.includes(cardName), `Missing VI card: ${cardName}`);
    }

    const enRes = await httpGet(appCtx.server, '/en/rules');
    assert.equal(enRes.status, 200);
    assert.match(enRes.headers['content-type'] || '', /text\/html/i);
    assert.ok(enRes.body.includes('<html lang="en">'));
    assert.ok(enRes.body.includes('<link rel="canonical" href="/en/rules" />'));
    assert.ok(enRes.body.includes('hreflang="vi" href="/luat-choi"'));
    assert.ok(enRes.body.includes('href="/"'));
    assert.ok(enRes.body.includes('Play Now'));

    const enLd = extractJsonLdBlocks(enRes.body);
    assert.equal(enLd.length, 1);
    const enTypes = enLd[0]['@graph'].map((node) => node['@type']);
    assert.deepEqual(enTypes, ['Article', 'FAQPage']);

    for (const cardName of [
      'Exploding Kitten',
      'Defuse',
      'Attack',
      'Skip',
      'Reverse',
      'Shuffle',
      'Favor',
      'See the Future',
      'Nope',
      'Striped Cat',
      'Taco Cat',
      'Hairy Potato Cat',
    ]) {
      assert.ok(enRes.body.includes(cardName), `Missing EN card: ${cardName}`);
    }
  } finally {
    await appCtx.close();
  }
});

test('GET /en localizes index.html with lang="en", English title, canonical, and og:locale="en_US"', async () => {
  const originalPublicUrl = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = 'https://kittens.example.com/';
  const appCtx = await startTestApp({
    clientDistDir: path.join(repoRoot, 'nonexistent-dist-dir'),
    clientPublicDir: realPublicDir,
  });

  try {
    const res = await httpGet(appCtx.server, '/en');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/i);
    assert.ok(res.body.includes('<html lang="en">'));
    assert.ok(
      res.body.includes('<title>Exploding Kittens Online — 2–10 Player Survival Card Game</title>')
    );
    assert.ok(
      res.body.includes('<link rel="canonical" href="https://kittens.example.com/en" />')
    );
    assert.ok(res.body.includes('<meta property="og:locale" content="en_US" />'));
    assert.ok(res.body.includes('<main class="seo-prerender">'));

    const jsonLd = extractJsonLdBlocks(res.body);
    assert.equal(jsonLd.length, 1);
    const graph = jsonLd[0]['@graph'];
    assert.deepEqual(graph[0]['@type'], ['VideoGame', 'WebApplication']);
    assert.equal(graph[1]['@type'], 'FAQPage');
    assert.ok(graph[1].mainEntity.length >= 4);
  } finally {
    await appCtx.close();
    if (originalPublicUrl === undefined) {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  }
});

test('GET / sets X-Robots-Tag: noindex, nofollow only when room or code query params are present', async () => {
  const appCtx = await startTestApp();

  try {
    const cleanHome = await httpGet(appCtx.server, '/');
    assert.equal(cleanHome.status, 200);
    assert.equal(cleanHome.headers['x-robots-tag'], undefined);

    const roomInvite = await httpGet(appCtx.server, '/?room=ABCDE');
    assert.equal(roomInvite.status, 200);
    assert.equal(roomInvite.headers['x-robots-tag'], 'noindex, nofollow');

    const codeInvite = await httpGet(appCtx.server, '/?code=XYZ12');
    assert.equal(codeInvite.status, 200);
    assert.equal(codeInvite.headers['x-robots-tag'], 'noindex, nofollow');
  } finally {
    await appCtx.close();
  }
});

test('client/public/og-cover.svg exists as a 1200x630 pastel SVG graphic', async () => {
  const svg = await fs.readFile(path.join(realPublicDir, 'og-cover.svg'), 'utf8');
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 1200 630"'));
  assert.ok(svg.includes('Mèo Nổ Online'));
  assert.ok(svg.includes('Exploding Kittens'));
});
