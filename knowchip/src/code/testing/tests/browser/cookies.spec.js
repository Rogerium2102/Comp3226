import { test, expect } from './fixtures.js';

const publisher = 'https://localhost:8443';
const tracker = 'https://127.0.0.1:8443';
const isBlocked = testInfo => testInfo.project.name === 'third-party-blocked';

test.beforeEach(async ({ page, context }, testInfo) => {
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  // Chromium test override, applied before navigation. This changes no user profile.
  await session.send('Network.setCookieControls', {
    enableThirdPartyCookieRestriction: isBlocked(testInfo),
  });
  await page.goto(publisher);
  await expect(page.locator('#status')).toContainText('Lab ready');
});

const seed = (page, scenario) => page.evaluate(async scenario => {
  const response = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario }) });
  if (!response.ok) throw new Error(`Seed failed: ${response.status}`);
}, scenario);
const echo = (page, path = '/api/echo') => page.evaluate(async path => (await (await fetch(path)).json()).cookies, path);
const observeTracker = async page => {
  await page.getByRole('button', { name: 'Observe cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Observation complete');
  return JSON.parse(await page.locator('#tracker-state').textContent());
};

test('landing page is clean and first-party essential metadata is stored correctly', async ({ page, context }) => {
  expect(await context.cookies()).toEqual([]);
  await page.getByRole('button', { name: 'Create essential cookies' }).click();
  await expect(page.locator('#cart-state')).toContainText('Cart active · 2 items');
  const stored = await context.cookies(publisher);
  expect(stored.map(cookie => cookie.name).sort()).toEqual(['kc_cart', 'kc_csrf', 'kc_session']);
  expect(stored.find(cookie => cookie.name === 'kc_session')).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', expires: -1 });
  expect(stored.find(cookie => cookie.name === 'kc_csrf')).toMatchObject({ secure: true, httpOnly: false, sameSite: 'Strict' });
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).toContain('kc_csrf=');
  expect(visible).not.toContain('kc_session=');
  expect(visible).not.toContain('kc_cart=');
  expect((await echo(page)).kc_session).toBe('dummy-session-001');
});

test('cookie-dependent feature survives keeping cookies and stops after deletion', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Create essential cookies' }).click();
  await page.getByRole('button', { name: 'Add one item' }).click();
  await expect(page.locator('#cart-state')).toContainText('3 items');
  await page.reload();
  await expect(page.locator('#cart-state')).toContainText('3 items');
  await context.clearCookies({ name: 'kc_session' });
  await observeTracker(page);
  await expect(page.locator('#cart-state')).toContainText('Cart unavailable');
  expect((await context.cookies()).some(cookie => cookie.name === 'kc_session')).toBe(false);
});

test('path matching includes /scoped/echo and excludes root and prefix lookalikes', async ({ page, context }) => {
  await seed(page, 'dummy');
  expect((await echo(page)).kc_scoped).toBeUndefined();
  expect((await echo(page, '/scoped/echo')).kc_scoped).toBe('scoped-only');
  expect((await echo(page, '/scopedness/echo')).kc_scoped).toBeUndefined();
  expect(await page.evaluate(() => document.cookie)).not.toContain('kc_scoped=');
  expect((await context.cookies(`${publisher}/scoped/echo`)).find(cookie => cookie.name === 'kc_scoped')).toMatchObject({ path: '/scoped', httpOnly: false });
});

test('short-lived cookie expires and observation does not regenerate it', async ({ page, context }) => {
  await seed(page, 'lifetime');
  expect((await echo(page)).kc_short).toBe('expires-soon');
  await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name === 'kc_short'), { timeout: 9000, intervals: [500, 1000] }).toBe(false);
  expect((await echo(page)).kc_short).toBeUndefined();
});

test('cross-site HTTP and script cookies follow the selected browser policy; CHIPS is separate', async ({ page, context }, testInfo) => {
  await page.getByRole('button', { name: 'Emit third-party cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Third-party emission finished');
  const state = JSON.parse(await page.locator('#tracker-state').textContent());
  expect(state.requestContext).toBe('cross-site');
  expect(state.attempted).toEqual(['tp_tracker', 'tp_script', 'tp_partitioned', 'tp_invalid']);
  expect(state.sentBackToTracker.tp_invalid).toBeUndefined();
  expect(state.sentBackToTracker.tp_partitioned).toBe('dummy-chips-001');
  for (const name of ['tp_tracker', 'tp_script']) {
    if (isBlocked(testInfo)) expect(state.sentBackToTracker[name]).toBeUndefined();
    else expect(state.sentBackToTracker[name]).toBeTruthy();
  }
  const stored = await context.cookies();
  expect(stored.some(cookie => cookie.name === 'tp_invalid')).toBe(false);
  const chips = stored.find(cookie => cookie.name === 'tp_partitioned');
  expect(chips).toMatchObject({ domain: '127.0.0.1', sameSite: 'None', secure: true, httpOnly: true, partitionKey: 'https://localhost' });
  expect(state.visibleToIframeJavaScript).not.toContain('tp_tracker=');
  expect(state.visibleToIframeJavaScript).not.toContain('tp_partitioned=');
  if (!isBlocked(testInfo)) expect(state.visibleToIframeJavaScript).toContain('tp_script=');
  expect((await echo(page)).tp_tracker).toBeUndefined();
});

test('top-level SameSite Strict and Lax cookies are absent from cross-site iframe requests', async ({ page, context }) => {
  const top = await context.newPage();
  await top.goto(tracker);
  await top.getByRole('button', { name: 'Seed SameSite controls' }).click();
  await expect(top.locator('#status')).toContainText('Seeded top-level');
  const topCookies = await echo(top);
  expect(topCookies.tp_strict).toBe('strict-control');
  expect(topCookies.tp_lax).toBe('lax-control');
  const state = await observeTracker(page);
  expect(state.sentBackToTracker.tp_strict).toBeUndefined();
  expect(state.sentBackToTracker.tp_lax).toBeUndefined();
  expect((await context.cookies()).some(cookie => cookie.name === 'tp_strict')).toBe(true);
  await top.close();
});

test('CHIPS cookie is associated with the publisher top-level site', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Emit partitioned cookie only' }).click();
  await expect(page.locator('#status')).toContainText('Partitioned emission finished');
  expect((await context.cookies()).find(cookie => cookie.name === 'tp_partitioned').partitionKey).toBe('https://localhost');
  const top = await context.newPage();
  await top.goto(tracker);
  expect((await echo(top)).tp_partitioned).toBeUndefined();
  await top.close();
});

test('reject then accept then reject preserves essentials and respects browser policy', async ({ page, context }, testInfo) => {
  await seed(page, 'essential');
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Optional fixtures rejected');
  expect((await context.cookies()).map(cookie => cookie.name).sort()).toEqual(['kc_cart', 'kc_consent', 'kc_csrf', 'kc_session']);
  await page.getByRole('button', { name: 'Show consent banner' }).click();
  await page.getByRole('button', { name: 'Accept optional cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Optional fixtures accepted');
  expect((await context.cookies()).some(cookie => cookie.name === 'kc_theme')).toBe(true);
  const state = JSON.parse(await page.locator('#tracker-state').textContent());
  expect(Boolean(state.sentBackToTracker.tp_tracker)).toBe(!isBlocked(testInfo));
  await page.getByRole('button', { name: 'Show consent banner' }).click();
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Optional fixtures rejected');
  const remaining = (await context.cookies()).map(cookie => cookie.name);
  expect(remaining).toContain('kc_session');
  expect(remaining).toContain('kc_cart');
  for (const name of ['kc_theme', 'kc_analytics', 'kc_scoped', 'tp_tracker', 'tp_script', 'tp_partitioned']) expect(remaining).not.toContain(name);
});

test('reset removes path-scoped and partitioned fixtures; observation stays empty', async ({ page, context }) => {
  await seed(page, 'essential');
  await seed(page, 'dummy');
  await page.getByRole('button', { name: 'Emit third-party cookies', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Third-party emission finished');
  await page.getByRole('button', { name: 'Reset lab cookies' }).click();
  await expect(page.locator('#status')).toContainText('Reset lab cookies');
  expect(await context.cookies()).toEqual([]);
  await observeTracker(page);
  expect(await context.cookies()).toEqual([]);
  await expect(page.locator('#cart-state')).toContainText('Cart unavailable');
});

test('forged or stale iframe messages do not replace observations', async ({ page }) => {
  const original = await page.locator('#tracker-state').textContent();
  await page.evaluate(() => window.postMessage({ type: 'knowchip-observation', run: 'fake', received: { attacker: 'value' } }, location.origin));
  expect(await page.locator('#tracker-state').textContent()).toBe(original);
  await observeTracker(page);
  const observed = await page.locator('#tracker-state').textContent();
  const frame = page.frames().find(frame => frame.url().startsWith(`${tracker}/embed`));
  await frame.evaluate(publisher => parent.postMessage({ type: 'knowchip-observation', run: 'stale-run', received: { attacker: 'value' } }, publisher), publisher);
  // Let queued postMessage delivery finish before asserting that it was ignored.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.locator('#tracker-state').textContent()).toBe(observed);
});
