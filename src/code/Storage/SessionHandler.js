
/**
 * Get Storage from the given tab
 * @param tabID
 * @return {Promise<Awaited<{localStorage: {[p: string]: any}, sessionStorage: {[p: string]: any}}>>}
 */
async function getTabStorage(tabID) {
    const [{result}] = await chrome.scripting.executeScript({
        target: tabID,
        func: () => {
            return {
                localStorage: Object.fromEntries(Object.entries(window.localStorage)),
                sessionStorage: Object.fromEntries(Object.entries(window.sessionStorage))
            };
        }
    });
    return result;
}

/**
 * Gets all the items in session and local storage based off the URL. The URL uses RegEx
 * @param {list<string>} url
 * @returns {Promise<{}>}
 */
export async function getTabStorageFromUrl(url) {
    const tabs = await chrome.tabs.query({url : url});
    const result = {};
    for (const tab of tabs) {
        try {
            result[tab.url] = await getTabStorage(tab.id);
        } catch (e) {
            console.warn(`Unable to get session storage from tab ${tab.id}`);
        }
    }
    return result;
}

/**
 * Gets all session and local storages from every open tab
 * @returns {Promise<{}>}
 */
export async function getAllStorageFromTabs() {
    return getTabFromUrl(['http://*/*','https://*/*'])
}