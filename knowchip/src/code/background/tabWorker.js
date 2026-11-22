import {runBannerHandler} from "../banner/BannerHandler.js";

export async function getCurrentPage() {
    const tab = await getCurrentTab();
    if (tab === null) return null;
    const results = await chrome.scripting.executeScript({
        target: tab.id,
        func: () => {
            return {
                title: document.title,
                url: document.location.href,
                html:document.documentElement.outerHTML,
                headings: Array.from(document.querySelectorAll('h1')).map((el) => el.textContent),
            };
        },
    });
    const pageData = results[0]?.result;
    console.log("Page data from tab:", pageData);
    return pageData;
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id || !tab.url?.startsWith('http')) {
        console.warn("Unable to acquire current tab");
        return null;
    }
    return tab;
}

export async function runSelectorOnTab(selector) {
    const tab = await getCurrentTab();
    if (tab === null) return null;
    const [{result}] = await chrome.scripting.executeScript({
        target: tab.id,
        args: [selector],
        func: (sel) => {
            const el = document.querySelectorAll(sel);
            if (!el) return null;

            return {
                tagName: el.tagName,
                text: el.textContent?.trim() ?? '',
                html: el.innerHTML,
                value: el.value ?? null,
                href: el.getAttribute('href')
            };
        },
    });
    return result;
}

export async function insertAutoRejectScript() {
    return await insertScriptInCurrentTab(true, runBannerHandler);
}

/**
 * Execute the given script in the current tab.
 * @param {boolean} executeInChildFrames
 * @param {void => void} script
 * @param {string} world
 * @return {Promise<void>}
 */
export async function insertScriptInCurrentTab(executeInChildFrames, script, world = "ISOLATED") {
    const tab = await getCurrentTab();
    return await insertScriptInATab(tab.id, executeInChildFrames, script);
}

/**
 * Executes the specified script in a tab
 * @param {number} tabId
 * @param {boolean} executeInChildFrames
 * @param {void => void} script
 * @param {string} world
 * @return {Promise<void>}
 */
export async function insertScriptInATab(tabId, executeInChildFrames, script, world = "ISOLATED") {
    if (tabId === null || tabId <0) {
        return null;
    }
    return await chrome.scripting.executeScript({
        target: {tabId: tabId, allFrames: executeInChildFrames},
        func: script,
        world: world,
    });
}

/**
 * insert a file into the current tab
 * @param {boolean} executeInChildFrames
 * @param {list<string>} files
 * @param {string} world
 * @return {Promise<void>}
 */
export async function insertFileInCurrentTab(executeInChildFrames, files,world = "ISOLATED") {
    const tab = await getCurrentTab();
    return await insertFileInATab(tab.id, executeInChildFrames, files, world);
}

/**
 * Insert a file into the given tab.
 * @param {number} tabId
 * @param {boolean} executeInChildFrames
 * @param {list<string>} files
 * @param {string} world
 * @return {Promise<Array<chrome.scripting.InjectionResult<Awaited<unknown>>>|null>}
 */
export async function insertFileInATab(tabId, executeInChildFrames, files, world = "ISOLATED") {
    if (tabId === null || tabId <0) {
        return null;
    }
    return await chrome.scripting.executeScript({
        tabId: {tabId: tabId, allFrames: executeInChildFrames},
        files: files,
        world: world
    });
}