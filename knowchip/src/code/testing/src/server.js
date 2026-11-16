import https from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ensureCertificates } from '../scripts/certificates.js';
import { cookies, selectCookies, serializeCookie, parseFixtureCookies } from './cookies.js';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/embed', ['embed.html', 'text/html; charset=utf-8']],
  ['/embed.js', ['embed.js', 'text/javascript; charset=utf-8']],
]);

function sendJSON(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readJSON(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error('Body too large');
  }
  return JSON.parse(body || '{}');
}

export function createLabServer() {
  const certificate = ensureCertificates();
  return https.createServer({ key: readFileSync(certificate.key), cert: readFileSync(certificate.cert) }, async (request, response) => {
    const port = request.socket.localPort;
    const publisher = `https://localhost:${port}`;
    const tracker = `https://127.0.0.1:${port}`;
    const host = request.headers.host;
    const site = host === `localhost:${port}` ? 'publisher' : host === `127.0.0.1:${port}` ? 'tracker' : null;
    if (!site) return sendJSON(response, 421, { error: 'Use the printed localhost or 127.0.0.1 URL.' });
    const origin = site === 'publisher' ? publisher : tracker;
    const url = new URL(request.url, origin);
    const incoming = parseFixtureCookies(request.headers.cookie);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src ${tracker}; frame-ancestors ${publisher}; base-uri 'none'; form-action 'self'`);
    if (!['GET', 'POST', 'HEAD'].includes(request.method)) return sendJSON(response, 405, { error: 'Method not allowed' });
    if (request.method === 'POST' && request.headers.origin !== origin) return sendJSON(response, 403, { error: 'Open the lab page before using its controls (Origin must match).' });
    const setCookies = (items, options) => {
      if (items.length) response.setHeader('Set-Cookie', items.map(cookie => serializeCookie(cookie, options)));
    };
    try {
      if (url.pathname === '/api/health') return sendJSON(response, 200, { ok: true, service: 'knowchip-cookie-lab', publisher, tracker });
      if (url.pathname === '/api/manifest') return sendJSON(response, 200, { publisher, tracker, site, cookies });
      if (['/api/echo', '/scoped/echo', '/scopedness/echo'].includes(url.pathname)) {
        return sendJSON(response, 200, { site, cookies: incoming, fetchSite: request.headers['sec-fetch-site'] ?? 'unknown' });
      }
      if (url.pathname === '/api/cart' && request.method === 'GET') {
        const active = incoming.kc_session === 'dummy-session-001' && /^\d{1,3}$/.test(incoming.kc_cart ?? '');
        return sendJSON(response, 200, { active, quantity: active ? Number(incoming.kc_cart) : 0, message: active ? 'Dummy cart is available.' : 'Cart unavailable: create the essential cookies first.' });
      }
      if (request.method === 'POST') {
        const body = await readJSON(request);
        if (url.pathname === '/api/reset') {
          setCookies(cookies.filter(cookie => cookie.site === site), { remove: true, value: '' });
          return sendJSON(response, 200, { reset: site });
        }
        if (url.pathname === '/api/seed' && site === 'publisher') {
          if (!['essential', 'dummy', 'lifetime'].includes(body.scenario)) return sendJSON(response, 400, { error: 'scenario must be essential, dummy, or lifetime' });
          const selected = selectCookies(site, [body.scenario]);
          setCookies(selected);
          return sendJSON(response, 200, { attempted: selected.map(cookie => cookie.name) });
        }
        if (url.pathname === '/api/consent' && site === 'publisher') {
          if (!['accepted', 'rejected'].includes(body.choice)) return sendJSON(response, 400, { error: 'choice must be accepted or rejected' });
          const consent = cookies.find(cookie => cookie.name === 'kc_consent');
          const optional = selectCookies(site, body.choice === 'accepted' ? ['dummy'] : ['dummy', 'lifetime']);
          response.setHeader('Set-Cookie', [serializeCookie(consent, { value: body.choice }), ...optional.map(cookie => serializeCookie(cookie, { remove: body.choice === 'rejected' }))]);
          return sendJSON(response, 200, { choice: body.choice });
        }
        if (url.pathname === '/api/cart' && site === 'publisher') {
          if (incoming.kc_session !== 'dummy-session-001' || !/^\d{1,3}$/.test(incoming.kc_cart ?? '')) return sendJSON(response, 409, { error: 'Essential session/cart cookies are missing.' });
          const quantity = Math.min(Number(incoming.kc_cart) + 1, 999);
          setCookies([cookies.find(cookie => cookie.name === 'kc_cart')], { value: String(quantity) });
          return sendJSON(response, 200, { quantity });
        }
        if (url.pathname === '/api/tracker-seed' && site === 'tracker') {
          const selected = selectCookies(site, ['controls']);
          setCookies(selected);
          return sendJSON(response, 200, { attempted: selected.map(cookie => cookie.name) });
        }
        return sendJSON(response, 404, { error: 'Unknown lab action' });
      }
      if (url.pathname === '/embed' && site === 'tracker') {
        const mode = url.searchParams.get('mode') ?? 'all';
        const groups = { all: ['unpartitioned', 'partitioned', 'invalid'], unpartitioned: ['unpartitioned'], partitioned: ['partitioned'], probe: [], reset: [] };
        if (!Object.hasOwn(groups, mode)) return sendJSON(response, 400, { error: 'Unknown iframe mode' });
        if (mode === 'reset') setCookies(cookies.filter(cookie => cookie.site === site), { remove: true, value: '' });
        else setCookies(selectCookies(site, groups[mode]));
      } else if (url.pathname === '/embed') return sendJSON(response, 404, { error: 'Embed is only served on the tracker site' });
      const asset = assets.get(url.pathname);
      if (!asset) return sendJSON(response, 404, { error: 'Not found' });
      let content = readFileSync(new URL(`./public/${asset[0]}`, import.meta.url));
      if (url.pathname === '/embed') {
        const fetchSite = ['cross-site', 'same-site', 'same-origin', 'none'].includes(request.headers['sec-fetch-site']) ? request.headers['sec-fetch-site'] : 'unknown';
        content = content.toString().replace('<body>', `<body data-request-site="${fetchSite}">`);
      }
      response.writeHead(200, { 'Content-Type': asset[1] });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      sendJSON(response, 400, { error: error instanceof SyntaxError ? 'Invalid JSON' : 'Could not process lab request' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8443);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = createLabServer();
  server.on('error', error => { console.error(`Cookie lab failed: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`KnowChip Cookie Lab\nPublisher: https://localhost:${port}\nTracker:   https://127.0.0.1:${port}\nBound to loopback only. Press Ctrl+C to stop.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
