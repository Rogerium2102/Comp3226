// Purpose/essential are test ground truth, not attributes browsers put on cookies.
export const cookies = Object.freeze([
  { name: 'kc_session', value: 'dummy-session-001', site: 'publisher', group: 'essential', purpose: 'Dummy session used by the cart', essential: true, secure: true, httpOnly: true, sameSite: 'Lax', path: '/' },
  { name: 'kc_csrf', value: 'dummy-csrf-001', site: 'publisher', group: 'essential', purpose: 'Example CSRF token metadata (no real authentication)', essential: true, secure: true, httpOnly: false, sameSite: 'Strict', path: '/', maxAge: 3600 },
  { name: 'kc_cart', value: '2', site: 'publisher', group: 'essential', purpose: 'Item count for the dummy cart', essential: true, secure: true, httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 86400 },
  { name: 'kc_consent', value: 'rejected', site: 'publisher', group: 'consent', purpose: 'Remember the optional-cookie choice', essential: true, secure: true, httpOnly: false, sameSite: 'Lax', path: '/', maxAge: 86400 },
  { name: 'kc_theme', value: 'dark', site: 'publisher', group: 'dummy', purpose: 'Non-essential preference example', essential: false, secure: true, httpOnly: false, sameSite: 'Lax', path: '/', maxAge: 2592000 },
  { name: 'kc_analytics', value: 'dummy-visitor-001', site: 'publisher', group: 'dummy', purpose: 'Synthetic first-party analytics identifier', essential: false, secure: true, httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 86400 },
  { name: 'kc_scoped', value: 'scoped-only', site: 'publisher', group: 'dummy', purpose: 'Only sent to /scoped and its descendants', essential: false, secure: true, httpOnly: false, sameSite: 'Lax', path: '/scoped', maxAge: 3600 },
  { name: 'kc_short', value: 'expires-soon', site: 'publisher', group: 'lifetime', purpose: 'Five-second expiry example', essential: false, secure: true, httpOnly: false, sameSite: 'Lax', path: '/', maxAge: 5 },
  { name: 'tp_tracker', value: 'dummy-third-party-001', site: 'tracker', group: 'unpartitioned', purpose: 'Cross-site HTTP Set-Cookie example', essential: false, secure: true, httpOnly: true, sameSite: 'None', path: '/', maxAge: 86400 },
  { name: 'tp_script', value: 'dummy-script-001', site: 'tracker', group: 'script', purpose: 'Cross-site document.cookie example', essential: false, secure: true, httpOnly: false, sameSite: 'None', path: '/', maxAge: 86400 },
  { name: 'tp_partitioned', value: 'dummy-chips-001', site: 'tracker', group: 'partitioned', purpose: 'CHIPS cookie scoped to the top-level site', essential: false, secure: true, httpOnly: true, sameSite: 'None', path: '/', maxAge: 86400, partitioned: true },
  { name: 'tp_strict', value: 'strict-control', site: 'tracker', group: 'controls', purpose: 'Seed top-level; must not be sent in a cross-site iframe', essential: false, secure: true, httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 86400 },
  { name: 'tp_lax', value: 'lax-control', site: 'tracker', group: 'controls', purpose: 'Seed top-level; must not be sent in a cross-site iframe', essential: false, secure: true, httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 86400 },
  { name: 'tp_invalid', value: 'must-be-rejected', site: 'tracker', group: 'invalid', purpose: 'Negative control: SameSite=None without Secure', essential: false, secure: false, httpOnly: false, sameSite: 'None', path: '/', maxAge: 86400, expectRejected: true },
].map(Object.freeze));

export function serializeCookie(cookie, { remove = false, value = cookie.value } = {}) {
  if (!/^[a-zA-Z0-9_]+$/.test(cookie.name) || !/^\/[a-zA-Z0-9/_-]*$/.test(cookie.path)) {
    throw new Error('Invalid fixture name/path');
  }
  if (!['Lax', 'Strict', 'None'].includes(cookie.sameSite)) throw new Error('Invalid SameSite');
  const parts = [`${cookie.name}=${encodeURIComponent(value)}`, `Path=${cookie.path}`, `SameSite=${cookie.sameSite}`];
  if (cookie.secure) parts.push('Secure');
  if (cookie.httpOnly) parts.push('HttpOnly');
  if (cookie.partitioned) parts.push('Partitioned');
  if (remove) parts.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  else if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  return parts.join('; ');
}

export function selectCookies(site, groups) {
  return cookies.filter(cookie => cookie.site === site && groups.includes(cookie.group));
}

export function parseFixtureCookies(header = '') {
  const known = new Set(cookies.map(cookie => cookie.name));
  const values = {};
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (!known.has(name)) continue;
    try { values[name] = decodeURIComponent(pair.slice(separator + 1).trim()); }
    catch { values[name] = pair.slice(separator + 1).trim(); }
  }
  return values;
}

// Chrome API-shaped fake metadata for unit tests; no real browser cookies created.
export function createCookieFixtures({ now = Date.now() / 1000 } = {}) {
  return cookies.filter(cookie => !cookie.expectRejected).map(cookie => ({
    name: cookie.name, value: cookie.value,
    domain: cookie.site === 'publisher' ? 'localhost' : '127.0.0.1',
    path: cookie.path, secure: cookie.secure, httpOnly: cookie.httpOnly,
    hostOnly: true, session: cookie.maxAge === undefined, storeId: '0',
    sameSite: ({ Lax: 'lax', Strict: 'strict', None: 'no_restriction' })[cookie.sameSite],
    ...(cookie.maxAge === undefined ? {} : { expirationDate: now + cookie.maxAge }),
    ...(cookie.partitioned ? { partitionKey: { topLevelSite: 'https://localhost', hasCrossSiteAncestor: true } } : {}),
  }));
}
