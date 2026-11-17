const config = await (await fetch('/api/manifest')).json();
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'all';
const byName = name => config.cookies.find(cookie => cookie.name === name);
const attempted = [];
if (['all', 'unpartitioned'].includes(mode)) {
  const script = byName('tp_script');
  document.cookie = `${script.name}=${script.value}; Path=/; SameSite=None; Secure; Max-Age=${script.maxAge}`;
  attempted.push('tp_tracker', 'tp_script');
}
if (['all', 'partitioned'].includes(mode)) attempted.push('tp_partitioned');
if (mode === 'all') attempted.push('tp_invalid');
const echo = await (await fetch('/api/echo', { cache: 'no-store' })).json();
parent.postMessage({ type: 'knowchip-observation', run: params.get('run'), attempted,
  received: echo.cookies, visible: document.cookie, fetchSite: document.body.dataset.requestSite }, config.publisher);
