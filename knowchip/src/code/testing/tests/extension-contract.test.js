import test from 'node:test';
import assert from 'node:assert/strict';
import { createCookieFixtures } from '../fixtures/chrome-cookies.js';

// The source under upstream/ is an unchanged, read-only reference snapshot.
// These are unit contract tests with Chrome mocks, not full extension UI tests.
async function setup(t, input = createCookieFixtures()) {
  const saved = globalThis.chrome;
  const cache = {};
  let calls = 0;
  globalThis.chrome = {
    cookies: { getAll: async () => { calls++; return structuredClone(input); } },
    storage: { session: {
      get: async keys => {
        if (keys === null) return structuredClone(cache);
        const result = {};
        for (const key of typeof keys === 'string' ? [keys] : keys) {
          if (key in cache) result[key] = structuredClone(cache[key]);
        }
        return result;
      },
      set: async values => Object.assign(cache, structuredClone(values)),
    } },
  };
  t.after(() => { if (saved === undefined) delete globalThis.chrome; else globalThis.chrome = saved; });
  const handler = await import(`./upstream/CookieHandler.js?test=${crypto.randomUUID()}`);
  return { handler, cache, calls: () => calls, input };
}

test('upstream retrieval returns fake browser cookies and uses its warm memory cache', async t => {
  const { handler, cache, calls, input } = await setup(t);
  assert.deepEqual(await handler.getAllCookies(), input);
  assert.deepEqual(await handler.getAllCookies(), input);
  assert.equal(calls(), 1);
  assert.deepEqual(cache.sessionCookies, input);
  assert.ok(cache.sessionExpiry > Date.now());
});

test('upstream name filtering returns one cookie and undefined for an unknown name', async t => {
  const { handler } = await setup(t);
  assert.equal((await handler.getCookieByName('kc_cart')).value, '2');
  assert.equal(await handler.getCookieByName('nonexistent'), undefined);
});

test('upstream exact-domain filter separates the two local fixture hosts', async t => {
  const { handler } = await setup(t);
  const first = await handler.getCookiesByDomain('localhost');
  const third = await handler.getCookiesByDomain('127.0.0.1');
  assert.ok(first.length > 0 && first.every(cookie => cookie.name.startsWith('kc_')));
  assert.ok(third.length > 0 && third.every(cookie => cookie.name.startsWith('tp_')));
  assert.deepEqual(await handler.getCookiesByDomain('example.com'), []);
});

test('upstream expiration filter excludes session and expired cookies', async t => {
  const now = Date.now() / 1000;
  const input = createCookieFixtures({ now });
  input.push({ ...input[0], name: 'expired', session: false, expirationDate: now - 10 });
  const { handler } = await setup(t, input);
  const result = await handler.getCookiesByExpiringWithinDays(0.5);
  const names = result.map(cookie => cookie.name);
  assert.ok(names.includes('kc_csrf') && names.includes('kc_short'));
  assert.ok(!names.includes('kc_session') && !names.includes('expired') && !names.includes('kc_theme'));
});

test('upstream custom predicates operate on realistic cookie flags and partition metadata', async t => {
  const { handler } = await setup(t);
  const httpOnly = await handler.getCookiesByPredicate(cookie => cookie.httpOnly);
  assert.ok(httpOnly.some(cookie => cookie.name === 'kc_session'));
  assert.ok(!httpOnly.some(cookie => cookie.name === 'tp_script'));
  const partitioned = await handler.getCookiesByPredicate(cookie => Boolean(cookie.partitionKey));
  assert.deepEqual(partitioned.map(cookie => cookie.name), ['tp_partitioned']);
});
