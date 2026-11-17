import test from 'node:test';
import assert from 'node:assert/strict';
import { cookies, serializeCookie, selectCookies, parseFixtureCookies, createCookieFixtures } from '../src/cookies.js';

test('catalogue has unique names and purpose metadata for all three required tasks', () => {
  assert.equal(new Set(cookies.map(cookie => cookie.name)).size, cookies.length);
  assert.equal(selectCookies('publisher', ['essential']).length, 3);
  assert.ok(selectCookies('publisher', ['dummy']).length >= 3);
  assert.ok(selectCookies('tracker', ['unpartitioned']).length > 0);
  assert.ok(cookies.every(cookie => cookie.purpose && typeof cookie.essential === 'boolean'));
});

test('session fixtures omit persistent expiry; persistent fixtures include Max-Age', () => {
  const session = serializeCookie(cookies.find(cookie => cookie.name === 'kc_session'));
  assert.match(session, /Secure; HttpOnly/);
  assert.doesNotMatch(session, /Expires=|Max-Age=/);
  assert.match(serializeCookie(cookies.find(cookie => cookie.name === 'kc_csrf')), /SameSite=Strict; Secure; Max-Age=3600/);
});

test('third-party fixtures use None and Secure; negative control intentionally omits Secure', () => {
  const valid = cookies.filter(cookie => cookie.site === 'tracker' && ['unpartitioned', 'script', 'partitioned'].includes(cookie.group));
  assert.ok(valid.every(cookie => cookie.secure && cookie.sameSite === 'None'));
  assert.match(serializeCookie(valid.find(cookie => cookie.partitioned)), /Partitioned/);
  const invalid = serializeCookie(cookies.find(cookie => cookie.name === 'tp_invalid'));
  assert.match(invalid, /SameSite=None/);
  assert.doesNotMatch(invalid, /; Secure/);
});

test('deletion preserves name, path and partition attribute and expires the cookie', () => {
  for (const cookie of cookies) {
    const header = serializeCookie(cookie, { remove: true, value: '' });
    assert.ok(header.startsWith(`${cookie.name}=; Path=${cookie.path};`));
    assert.match(header, /Max-Age=0; Expires=Thu, 01 Jan 1970/);
    assert.equal(header.includes('; Partitioned'), Boolean(cookie.partitioned));
  }
});

test('values are encoded; fixture-name/path injection is rejected', () => {
  assert.match(serializeCookie(cookies[0], { value: 'a; b=1\r\n' }), /a%3B%20b%3D1%0D%0A/);
  assert.throws(() => serializeCookie({ ...cookies[0], name: 'bad\r\nX: value' }));
  assert.throws(() => serializeCookie({ ...cookies[0], path: '/; injected=1' }));
});

test('echo parser keeps fixture cookies only and tolerates malformed percent encoding', () => {
  assert.deepEqual(parseFixtureCookies('unknown=secret; kc_theme=a%20b; kc_cart=2; kc_session=%zz'), {
    kc_theme: 'a b', kc_cart: '2', kc_session: '%zz',
  });
});

test('fake metadata matches Chrome schema and encodes session, expiry, host and partition distinctions', () => {
  const fixtures = createCookieFixtures({ now: 1700000000 });
  assert.equal(fixtures.find(cookie => cookie.name === 'kc_session').session, true);
  assert.equal(fixtures.find(cookie => cookie.name === 'kc_session').expirationDate, undefined);
  assert.equal(fixtures.find(cookie => cookie.name === 'kc_short').expirationDate, 1700000005);
  assert.equal(fixtures.find(cookie => cookie.name === 'tp_tracker').sameSite, 'no_restriction');
  assert.equal(fixtures.find(cookie => cookie.name === 'tp_partitioned').partitionKey.topLevelSite, 'https://localhost');
  assert.ok(fixtures.every(cookie => cookie.hostOnly && cookie.storeId === '0'));
  assert.ok(!fixtures.some(cookie => cookie.name === 'tp_invalid'));
  assert.equal(fixtures.some(cookie => 'essential' in cookie || 'party' in cookie), false);
});
