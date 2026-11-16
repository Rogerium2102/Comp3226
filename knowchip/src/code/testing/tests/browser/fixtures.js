import { test as base, expect } from '@playwright/test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// Incognito Chromium blocks third-party cookies even when the CDP restriction
// override is false. Use disposable regular profiles with explicit preferences.
export const test = base.extend({
  context: async ({ playwright, headless }, use, testInfo) => {
    const profile = testInfo.outputPath('chromium-profile');
    const blocked = testInfo.project.name === 'third-party-blocked';
    await mkdir(join(profile, 'Default'), { recursive: true });
    await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
      profile: { cookie_controls_mode: blocked ? 1 : 0, block_third_party_cookies: blocked },
    }));
    let context;
    try {
      context = await playwright.chromium.launchPersistentContext(profile, {
        headless, ignoreHTTPSErrors: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      });
      // Playwright's runner automatically records configured traces/screenshots
      // for contexts created during the test, including persistent contexts.
      await use(context);
    } finally {
      try {
        await context?.close();
      } finally {
        await rm(profile, { recursive: true, force: true });
      }
    }
  },
});

export { expect };
