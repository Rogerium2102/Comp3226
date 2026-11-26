import {runBannerHandler} from "../banner/BannerHandler.js";

export async function getCurrentPage() {
    const tab = await getCurrentTab();
    if (!tab) return null;
    const results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
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
    if (!tab) return null;
    const [{result}] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
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
    return await insertScriptInATab(tab?.id, executeInChildFrames, script);
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
    if (!tabId || tabId <0) {
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
    return await insertFileInATab(tab?.id, executeInChildFrames, files, world);
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
    if (!tabId || tabId <0) {
        return null;
    }
    return await chrome.scripting.executeScript({
        target: {tabId: tabId, allFrames: executeInChildFrames},
        files: files,
        world: world
    });
}

/* 
 * Designed to be injected into the script's ISOLATED world to communicate between injected.js and browser storage
 */
export async function insertCommsScript() {
    return await insertScriptInCurrentTab(false, function(){ //Injects script into ISOLATED World
        if (window.commsLoaded) return; //Prevents duplicate listeners
        window.commsLoaded = true;

        //Listener for any messages from EXTENSION environments
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

            switch (message.type) {
                case "REQUEST_DELETION_TO_ISOLATED":
                    //Creates listener for status response from MAIN
                    const deletionListener = "DELETION_STATUS_TO_ISOLATED";
                    function deleteHandler(event) { //Needs to be accessed by default statement below
                        if (event.detail?.datatype === message.datatype) {
                            window.removeEventListener(deletionListener, deleteHandler);
                            sendResponse({ success: Boolean(event.detail.success) });
                        }
                    }
                    window.addEventListener(deletionListener, deleteHandler);

                    switch (message?.datatype) {
                        //Fired by requestTrackerDeletion from deleterInExtWrld.js
                        //Sends message to injected.js
                        //Listens to MAIN response and forwards back to extension
                        case "tracker":
                            window.dispatchEvent(
                                new CustomEvent("DELETE_TRACKER_TO_MAIN", {
                                    detail: {
                                        key: message.key,
                                        strict: message.strict
                                    }
                                })
                            );
                            return true; //Keeps channel open

                        default:
                            console.error("Malformed message.datatype entered for deletion");
                            window.removeEventListener(deletionListener, deleteHandler);
                            return false;
                    }
                
                case "REQUEST_ADDITION_TO_ISOLATED":
                    //Creates listener for status response from MAIN
                    const additionListener = "ADDITION_STATUS_TO_ISOLATED";
                    function additionHandler(event) {
                        window.removeEventListener(additionListener, additionHandler);
                        sendResponse({ success: Boolean(event.detail.success) });
                    }
                    window.addEventListener(additionListener, additionHandler);

                    //Fired by regen from recyclingBin.js
                    //Sends data to injected.js
                    //Listens to MAIN for status response
                    window.dispatchEvent(
                        new CustomEvent("ADD_TO_MAIN", {
                            detail: {
                                key: message.key,
                                value: message.value,
                                storeType: message.storeType
                            }
                        })
                    );

                    return true;
                default:
                    break;
            }

        });

        //Fired by purgeTracker from deleterInMainWrld.js, passes deleted tracker key to extension world
        //Passes it to background.js
        window.addEventListener("DELETED_TRACKERS_TO_ISOLATED", async (event) => {
            const deletedTrackers = event.detail.trackers;
            chrome.runtime.sendMessage({
                type: "DELETED_TRACKERS_TO_EXTENSION",
                trackers: deletedTrackers
            });
        });

        //Fired by scanTracker from deleterInMainWrld.js
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