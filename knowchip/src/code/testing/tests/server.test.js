import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { createLabServer } from '../src/server.js';

let server, port;
before(async () => {
  server = createLabServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(() => new Promise(resolve => server.close(resolve)));

function request(path, { method = 'GET', body, site = 'publisher', cookie, origin, host } = {}) {
  const name = site === 'publisher' ? 'localhost' : '127.0.0.1';
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1', port, path, method, rejectUnauthorized: false,
      headers: { Host: host ?? `${name}:${port}`, ...(method === 'POST' ? { Origin: origin ?? `https://${name}:${port}`, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
}

test('home and observation routes never emit cookies', async () => {
  for (const path of ['/', '/api/health', '/api/echo', '/scoped/echo', '/api/cart', '/api/manifest']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
});

test('essential scenario emits exactly three distinct Set-Cookie headers', async () => {
  const response = await request('/api/seed', { method: 'POST', body: { scenario: 'essential' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers['set-cookie'].length, 3);
  assert.deepEqual(response.json().attempted, ['kc_session', 'kc_csrf', 'kc_cart']);
  assert.ok(response.headers['set-cookie'].every(value => value.includes('; Secure')));
});

test('cart requires real request cookies and does not silently restore them', async () => {
  assert.equal((await request('/api/cart')).json().active, false);
  assert.equal((await request('/api/cart', { method: 'POST', body: {} })).status, 409);
  assert.equal((await request('/api/cart', { cookie: 'kc_session=dummy-session-001; kc_cart=2' })).json().quantity, 2);
  const response = await request('/api/cart', { method: 'POST', body: {}, cookie: 'kc_session=dummy-session-001; kc_cart=2' });
  assert.equal(response.json().quantity, 3);
  assert.match(response.headers['set-cookie'][0], /^kc_cart=3;/);
});

test('invalid scenarios, malformed input and cross-origin POSTs are rejected', async () => {
  assert.equal((await request('/api/seed', { method: 'POST', body: { scenario: 'other' } })).status, 400);
  assert.equal((await request('/api/seed', { method: 'POST', body: '{bad' })).status, 400);
  assert.equal((await request('/api/seed', { method: 'POST', body: { scenario: 'essential' }, origin: 'https://example.com' })).status, 403);
  assert.equal((await request('/', { host: 'example.com' })).status, 421);
  assert.equal((await request('/embed?mode=toString', { site: 'tracker' })).status, 400);
});

test('tracker emits separate valid, CHIPS and deliberately invalid cookie headers', async () => {
  const response = await request('/embed?mode=all', { site: 'tracker' });
  assert.equal(response.status, 200);
  const headers = response.headers['set-cookie'];
  assert.equal(headers.length, 3);
  assert.ok(headers.some(value => value.startsWith('tp_tracker=') && value.includes('SameSite=None; Secure; HttpOnly')));
  assert.ok(headers.some(value => value.startsWith('tp_partitioned=') && value.includes('; Partitioned')));
  assert.ok(headers.some(value => value.startsWith('tp_invalid=') && !value.includes('; Secure')));
  assert.equal((await request('/embed?mode=probe', { site: 'tracker' })).headers['set-cookie'], undefined);
});

test('consent rejection deletes optional cookies and retains essential session/cart', async () => {
  const response = await request('/api/consent', { method: 'POST', body: { choice: 'rejected' } });
  const headers = response.headers['set-cookie'];
  assert.ok(headers.some(value => value.startsWith('kc_consent=rejected')));
  assert.ok(headers.some(value => value.startsWith('kc_scoped=') && value.includes('Path=/scoped') && value.includes('Max-Age=0')));
  assert.ok(!headers.some(value => value.startsWith('kc_session=') || value.startsWith('kc_cart=')));
});

test('reset expires only known cookies on the requested host, including scoped cookies', async () => {
  const response = await request('/api/reset', { method: 'POST', body: {} });
  assert.ok(response.headers['set-cookie'].every(value => value.startsWith('kc_') && value.includes('Max-Age=0')));
  assert.ok(response.headers['set-cookie'].some(value => value.includes('Path=/scoped')));
  const tracker = await request('/api/reset', { method: 'POST', site: 'tracker', body: {} });
  assert.ok(tracker.headers['set-cookie'].every(value => value.startsWith('tp_') && value.includes('Max-Age=0')));
});
