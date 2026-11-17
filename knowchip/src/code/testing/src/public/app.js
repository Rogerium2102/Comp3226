const $ = selector => document.querySelector(selector);
let config;
let pendingFrame;
let currentRun;

function log(message, error = false) {
  $('#status').textContent = message;
  $('#status').classList.toggle('error', error);
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  $('#activity-log').prepend(item);
  while ($('#activity-log').children.length > 12) $('#activity-log').lastChild.remove();
}

async function api(path, body) {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

async function refresh() {
  const state = await api('/api/echo');
  const scoped = await api('/scoped/echo');
  $('#server-state').textContent = JSON.stringify({ root: state.cookies, scoped: scoped.cookies }, null, 2);
  $('#script-state').textContent = document.cookie || '(none)';
  if (config.site === 'publisher') {
    const cart = await api('/api/cart');
    $('#cart-state').textContent = cart.active ? `Cart active · ${cart.quantity} items` : cart.message;
  }
  return state;
}

function observeFrame(mode) {
  if (pendingFrame) return Promise.reject(new Error('Wait for the current iframe observation to finish.'));
  currentRun = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingFrame = undefined;
      reject(new Error('Iframe did not respond. Check both HTTPS certificate pages and browser settings.'));
    }, 10000);
    pendingFrame = { resolve: data => { clearTimeout(timeout); pendingFrame = undefined; resolve(data); } };
    $('#tracker-frame').src = `${config.tracker}/embed?mode=${mode}&run=${currentRun}`;
  });
}

window.addEventListener('message', event => {
  if (!config || event.origin !== config.tracker || event.source !== $('#tracker-frame').contentWindow) return;
  const data = event.data;
  if (data?.type !== 'knowchip-observation' || data.run !== currentRun) return;
  $('#tracker-state').textContent = JSON.stringify({
    attempted: data.attempted, sentBackToTracker: data.received,
    visibleToIframeJavaScript: data.visible, requestContext: data.fetchSite,
    note: 'Attempted does not mean stored. Inspect DevTools for the exact blocking reason.',
  }, null, 2);
  pendingFrame?.resolve(data);
});

function onClick(id, action) {
  $(id).addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await action(); }
    catch (error) { log(error.message, true); }
    finally { button.disabled = false; }
  });
}

try {
  config = await api('/api/manifest');


  if (config.site === 'publisher') {
    document.title = 'KnowChip | Publisher Test Site';

    $('#page-title').textContent = 'Publisher Test Site';

    $('#page-description').textContent =
      'Simulates a normal website that creates first-party cookies ' +
      'and embeds a third-party tracking service. Use this site ' +
      'to test how the extension detects, inspects and removes cookies';

  } else if (config.site === 'tracker') {
    document.title = 'KnowChip | External Test Site';

    $('#page-title').textContent = 'Tracker Test Site';

    $('#page-description').textContent =
      'Simulates an external tracking service (third party website) used by the publisher. ' +
      'Open this page directly to create test cookies, then return ' +
      'to the publisher to observe how those cookies behave when ' +
      'the tracker is embedded as a third party';
  }

  $('#origin').textContent = location.origin;
  $('#site-label').textContent = config.site === 'publisher' ? 'PUBLISHER' : 'TRACKER · TOP LEVEL';
  $('#publisher-controls').hidden = config.site !== 'publisher';
  $('#third-party-controls').hidden = config.site !== 'publisher';
  $('#tracker-controls').hidden = config.site !== 'tracker';
  $('#tracker-link').href = config.tracker;
  $('#publisher-link').href = config.publisher;

  for (const cookie of config.cookies) {
    const row = document.createElement('tr');
    const details = [cookie.name, `${cookie.site === 'publisher' ? 'localhost' : '127.0.0.1'} · ${cookie.purpose}${cookie.essential ? ' [essential fixture]' : ''}`,
    [`SameSite=${cookie.sameSite}`, cookie.secure && 'Secure', cookie.httpOnly && 'HttpOnly', cookie.partitioned && 'Partitioned', cookie.expectRejected && 'EXPECTED REJECTION'].filter(Boolean).join(' · '),
    `${cookie.maxAge === undefined ? 'Session' : `${cookie.maxAge}s`} · ${cookie.path}`];
    for (const value of details) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    $('#catalogue').append(row);
  }

  onClick('#essential', async () => { await api('/api/seed', { scenario: 'essential' }); await refresh(); log('Created three first-party essential fixture cookies.'); });
  onClick('#dummy', async () => { await api('/api/seed', { scenario: 'dummy' }); await refresh(); log('Created preference, analytics, and path-scoped dummy cookies.'); });
  onClick('#lifetime', async () => { await api('/api/seed', { scenario: 'lifetime' }); await refresh(); log('Created kc_short. Observe again after five seconds to check expiry.'); });
  onClick('#add-item', async () => { await api('/api/cart', {}); await refresh(); log('Updated the cart cookie.'); });
  onClick('#third-party', async () => { await observeFrame('all'); log('Third-party emission finished. Compare attempted and received cookies.'); });
  onClick('#partitioned', async () => { await observeFrame('partitioned'); log('Partitioned emission finished. This cookie has a separate storage model.'); });
  onClick('#show-consent', () => { $('#consent-banner').hidden = false; log('Consent banner shown.'); });
  onClick('#accept', async () => {
    await api('/api/consent', { choice: 'accepted' });
    $('#consent-banner').hidden = true;
    await refresh(); await observeFrame('all'); log('Optional fixtures accepted; browser policy still applies.');
  });
  onClick('#reject', async () => {
    await api('/api/consent', { choice: 'rejected' });
    $('#consent-banner').hidden = true;
    await refresh(); await observeFrame('reset'); log('Optional fixtures rejected; essential cookies retained.');
  });
  onClick('#seed-controls', async () => { await api('/api/tracker-seed', {}); await refresh(); log('Seeded top-level SameSite=Lax and Strict controls.'); });
  onClick('#observe', async () => {
    await refresh();
    if (config.site === 'publisher') await observeFrame('probe');
    log('Observation complete. No new cookies were emitted.');
  });
  onClick('#reset', async () => {
    await api('/api/reset', {});
    await refresh();
    if (config.site === 'publisher') { await observeFrame('reset'); $('#consent-banner').hidden = false; }
    log('Reset lab cookies. For a blocked tracker, reset its top-level page too.');
  });
  const state = await refresh();
  $('#consent-banner').hidden = config.site !== 'publisher' || Boolean(state.cookies.kc_consent);
  log('Lab ready. No cookies are set until you use a creation or consent control.');
} catch (error) { log(error.message, true); }
