// Shared behaviour for eight independently designed banner pages.
// The extension should interact with the real visible DOM, not this script.
const site = document.documentElement.dataset.site;
const mode = document.documentElement.dataset.mode;
const base = `/sites/${site}/api`;
const banner = document.querySelector('[data-consent-banner]');
const inspector = document.querySelector('[data-test-state]');
const message = document.querySelector('[data-test-message]');
let busy = false;

async function request(action, data) {
  const response = await fetch(`${base}/${action}`, data === undefined
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function chosenOptions() {
  const result = { analytics: false, personalization: false, marketing: false };
  for (const input of document.querySelectorAll('[data-category]')) {
    result[input.dataset.category] = input.checked;
  }
  return result;
}

function setStage(stage) {
  for (const item of banner.querySelectorAll('[data-stage]')) item.hidden = item.dataset.stage !== stage;
  if (stage === 'confirmation') {
    const selected = Object.entries(chosenOptions()).filter(([, on]) => on).map(([key]) => key);
    document.querySelector('#selection-summary').textContent = selected.length
      ? `You have enabled: ${selected.join(', ')}. Confirm to save this custom selection.`
      : 'All optional purposes are off. Confirm to reject optional cookies.';
  }
}

async function updateState({ showBanner = false } = {}) {
  const state = await request('state');
  inspector.textContent = JSON.stringify(state, null, 2);
  if (state.decision !== null) {
    banner.hidden = true;
    message.textContent = `Saved outcome: ${state.decision}`;
  } else if (showBanner) {
    banner.hidden = false;
    message.textContent = 'No choice saved yet.';
  }
  return state;
}

async function save(choice) {
  if (busy) return;
  busy = true;
  try {
    const data = choice === 'custom' ? { choice, optional: chosenOptions() } : { choice };
    await request('decision', data);
    await updateState();
    if (mode === 'delayed') setStage('intro');
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
  } finally {
    busy = false;
  }
}

banner.addEventListener('click', event => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton && banner.contains(actionButton)) {
    event.preventDefault();
    const action = actionButton.dataset.action;
    save(action === 'save' ? 'custom' : action);
    return;
  }
  const stageButton = event.target.closest('[data-open]');
  if (stageButton && banner.contains(stageButton)) {
    event.preventDefault();
    setStage(stageButton.dataset.open);
  }
});

document.querySelector('[data-reset]').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    await request('reset', {});
    for (const input of document.querySelectorAll('[data-category]')) input.checked = true;
    for (const section of document.querySelectorAll('.purpose')) section.open = false;
    for (const item of banner.querySelectorAll('[data-stage]')) item.hidden = item.dataset.stage !== 'intro';
    const state = await updateState();
    if (state.decision === null) banner.hidden = false;
    message.textContent = 'Level reset. Make a new choice.';
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
  } finally {
    busy = false;
  }
});

try {
  const state = await updateState();
  if (state.decision === null) {
    if (mode === 'delayed') await new Promise(resolve => setTimeout(resolve, 1300));
    banner.hidden = false;
  }
} catch (error) {
  message.textContent = `Could not initialise test site: ${error.message}`;
}
