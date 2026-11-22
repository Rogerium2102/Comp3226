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
 * @return {Promise<void>}
 */
export async function insertScriptInCurrentTab(executeInChildFrames, script) {
    const tab = await getCurrentTab();
    return await insertScriptInATab(tab.id, executeInChildFrames, script);
}

/**
 * Executes the specified script in a tab
 * @param {number} tabId
 * @param {boolean} executeInChildFrames
 * @param {void => void} script
 * @return {Promise<void>}
 */
export async function insertScriptInATab(tabId, executeInChildFrames, script) {
    if (tabId === null || tabId <0) {
        return null;
    }
    return await chrome.scripting.executeScript({
        target: {tabId: tabId, allFrames: executeInChildFrames},
        func: script,
    });
}

/**
 * insert a file into the current tab
 * @param {boolean} executeInChildFrames
 * @param {list<string>} files
 * @return {Promise<void>}
 */
export async function insertFileInCurrentTab(executeInChildFrames, files) {
    const tab = await getCurrentTab();
    return await insertScriptInATab(tab.id, executeInChildFrames, files);
}

/**
 * Insert a file into the given tab.
 * @param {number} tabId
 * @param {boolean} executeInChildFrames
 * @param {list<string>} files
 * @return {Promise<Array<chrome.scripting.InjectionResult<Awaited<unknown>>>|null>}
 */
export async function insertFileInATab(tabId, executeInChildFrames, files) {
    if (tabId === null || tabId <0) {
        return null;
    }
    return await chrome.scripting.executeScript({
        tabId: {tabId: tabId, allFrames: executeInChildFrames},
        files: files
    });
}

/* 
 * Designed to be injected into the script's ISOLATED world to communicate between injected.js and browser storage
 */
export async function insertCommsScript() {
    if (window.commsLoaded) return; //Prevents duplicate listeners
    window.commsLoaded = true;

    return await insertScriptInCurrentTab(false, function(){ //Injects script into ISOLATED World

        //Fired by purgeTracker from storageDeleter.js, passes deleted tracker key to extension world
        //Passes it to background.js
        window.addEventListener("DELETED_TRACKERS_TO_ISOLATED", async (event) => {
            const deletedTrackerKeys = event.detail.keys;
            chrome.runtime.sendMessage({
                type: "DELETED_TRACKERS_TO_EXTENSION",
                keys: deletedTrackerKeys
            });
        });

        //Fired by scanTracker from storageDeleter.js
        //Passes it to background.js for response
        //Sends response back to INJECTED world
        window.addEventListener("CHECK_TRACKER_TO_ISOLATED", async (event) => {
            const trackerKey = event.detail.key;
            const response = await chrome.runtime.sendMessage({
                type: "CHECK_TRACKER_TO_EXTENSION",
                key: trackerKey
            });

            window.dispatchEvent(
                new CustomEvent("BLACKLIST_STATUS_TO_MAIN", {
                    detail: {
                        key: trackerKey, //Used by scanTracker to verify same response
                        status: response?.status ?? -1 //Attempts check status of response, if not available then an error val is sent
                    }
                })
            );
        });

        //Fired by fireSuspiciousStorageEvent from injected.js
        //Passes it to background.js
        window.addEventListener("SUSPICIOUS_COOKIE_DETECTED", (event) => {
            chrome.runtime.sendMessage({
                type: "BLACKLIST_TRACKER_TO_EXTENSION",
                key: event.detail.key
            });
        });
    });
}