import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import sites from './sites.json' with { type: 'json' };

const directory = dirname(fileURLToPath(import.meta.url));
const siteLookup = new Map(sites.map(site => [site.id, site]));
const PORT = Number(process.env.PORT || (process.argv.includes('--https') ? 8766 : 8765));
const HOST = '127.0.0.1';
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJSON(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function parseCookies(value = '') {
  const cookies = {};
  for (const item of value.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    try { cookies[key] = decodeURIComponent(item.slice(separator + 1).trim()); }
    catch { cookies[key] = item.slice(separator + 1).trim(); }
  }
  return cookies;
}

function cookieName(site, key) {
  return `bl_${site.num}_${key}`;
}

function makeCookie(site, key, value, expired = false) {
  const attributes = [`${cookieName(site, key)}=${encodeURIComponent(value)}`,
    `Path=/sites/${site.id}/`, 'SameSite=Lax', expired ? 'Max-Age=0' : 'Max-Age=86400'];
  return attributes.join('; ');
}

function currentState(site, request) {
  const jar = parseCookies(request.headers.cookie);
  return {
    site: site.id,
    decision: jar[cookieName(site, 'choice')] ?? null,
    essential: jar[cookieName(site, 'essential')] === '1',
    optional: Object.fromEntries(['analytics', 'personalization', 'marketing'].map(key => [key, jar[cookieName(site, key)] === '1'])),
  };
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) throw new Error('Request body exceeds the 8 KB limit');
  }
  return JSON.parse(body || '{}');
}

function writeCookieSet(res, values) {
  res.setHeader('Set-Cookie', values);
}

function serveFile(res, relativePath) {
  const file = join(directory, 'public', relativePath);
  const type = CONTENT_TYPES[extname(file)];
  if (!type || !existsSync(file)) return sendJSON(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(readFileSync(file));
}

export function createBannerServer({ secure = false } = {}) {
  const handle = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'POST'].includes(req.method)) return sendJSON(res, 405, { error: 'Method not allowed' });

    if (req.method === 'GET' && url.pathname === '/') return serveFile(res, 'index.html');
    if (req.method === 'GET' && url.pathname === '/api/sites') return sendJSON(res, 200, sites);
    if (req.method === 'GET' && /^\/assets\/(site|index)\.js$/.test(url.pathname)) return serveFile(res, url.pathname.slice(1));
    if (req.method === 'GET' && url.pathname === '/assets/styles.css') return serveFile(res, 'assets/styles.css');

    const match = /^\/sites\/([a-z0-9-]+)\/(?:api\/(state|decision|reset))?$/.exec(url.pathname);
    if (!match || !siteLookup.has(match[1])) return sendJSON(res, 404, { error: 'Unknown site' });
    const site = siteLookup.get(match[1]);
    const action = match[2];

    if (!action && req.method === 'GET') {
      if (!currentState(site, req).essential) writeCookieSet(res, [makeCookie(site, 'essential', '1')]);
      return serveFile(res, `sites/${site.id}.html`);
    }
    if (action === 'state' && req.method === 'GET') return sendJSON(res, 200, currentState(site, req));
    if (req.method !== 'POST' || !['decision', 'reset'].includes(action)) return sendJSON(res, 405, { error: 'Method not allowed' });

    const origin = req.headers.origin;
    const expectedOrigin = `${secure ? 'https' : 'http'}://${req.headers.host}`;
    if (origin !== expectedOrigin) return sendJSON(res, 403, { error: 'Incorrect Origin' });

    try {
      if (action === 'reset') {
        writeCookieSet(res, ['choice', 'analytics', 'personalization', 'marketing'].map(key => makeCookie(site, key, '', true)));
        return sendJSON(res, 200, { ok: true, reset: site.id });
      }
      const body = await readBody(req);
      const choice = body.choice;
      if (!['accept', 'reject', 'custom', 'paid'].includes(choice)) return sendJSON(res, 422, { error: 'Unknown choice' });
      if (site.mode === 'paywall' && !['accept', 'paid'].includes(choice)) return sendJSON(res, 422, { error: 'This fixture offers no free rejection' });
      if (site.mode !== 'paywall' && choice === 'paid') return sendJSON(res, 422, { error: 'Paid choice only applies to the paywall fixture' });
      const optional = Object.fromEntries(['analytics', 'personalization', 'marketing'].map(key => [key,
        choice === 'accept' || (choice === 'custom' && body.optional?.[key] === true)]));
      if (choice === 'custom' && Object.values(optional).some(Boolean) === false) {
        body.choice = 'reject';
      }
      writeCookieSet(res, [makeCookie(site, 'choice', body.choice), ...Object.entries(optional).map(([key, value]) => makeCookie(site, key, value ? '1' : '', !value))]);
      return sendJSON(res, 200, { ok: true, choice: body.choice, optional });
    } catch (error) {
      return sendJSON(res, 400, { error: error.message === 'Request body exceeds the 8 KB limit' ? error.message : 'Invalid JSON' });
    }
  };

  if (!secure) return http.createServer(handle);
  const certificateDirectory = resolve(directory, '..', '.certs');
  const key = join(certificateDirectory, 'localhost-key.pem');
  const cert = join(certificateDirectory, 'localhost.pem');
  if (!existsSync(key) || !existsSync(cert)) {
    throw new Error(`HTTPS certificate not found at ${certificateDirectory}. Run the existing cookie lab once to generate .certs, or use npm start (HTTP).`);
  }
  return https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, handle);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) throw new Error('Invalid PORT');
  const secure = process.argv.includes('--https');
  const server = createBannerServer({ secure });
  server.listen(PORT, HOST, () => {
    const base = `${secure ? 'https' : 'http'}://${HOST}:${PORT}`;
    console.log(`KnowChip Banner Sites: ${base}/`);
    for (const site of sites) console.log(`  ${site.num}: ${base}/sites/${site.id}/`);
    console.log('Local-only server. Ctrl+C to stop.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
