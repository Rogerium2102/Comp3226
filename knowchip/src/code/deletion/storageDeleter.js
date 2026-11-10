/**
 * Deletes a specific tracker from storages
 * @param {string} key
 * @param {Bool} equals - Whether to match the key exactly or partially
 * @returns {Promise<chrome.cookies.Cookie | null>}
 */
export async function purgeTracker(key, equals) {
    try {
        let searchKeys;
        if (equals) searchKeys = [key];
        else {
            let result;
            //Fetches all items from storage
            result = await chrome.browsingData.removeSessionStorage({ origins: [] }); //Dict of all items in storage

            //Filters items to only those containing the key
            searchKeys = Object.keys(result).filter(k => k.includes(key)); //String[]
        }

        await chrome.browsingData.removeSessionStorage({ origins: searchKeys});

        return true;
    } catch (err) {
        console.error(`Failed to delete ${isSession ? "session" : "local"} storage value ${equals ? "matching" : "containing"} ${key}:`, err);
        return false;
    }
}

/**
 * //Wipes the value of a cookie to prevent it from tracking a user
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<chrome.cookies.Cookie | null>}
 */
async function wipeCookie(cookie) {
    let cookieDetails = {...cookie}; //Creates shallow copy of cookie for editing
    getURL(cookieDetails);
    cookieDetails.value = "0"; //Wipes tracking value with truthy value

    //Cookie retrieval adds domain to host-only cookies, if domain set then it will be treated as a new cookie
    if (cookieDetails.domain && cookieDetails.hostOnly) cookieDetails.domain = undefined;
    //Unspecified value will error when setting a cookie
    if (cookieDetails.sameSite == "unspecified") cookieDetails.sameSite = undefined;

    try {
        const result = await chrome.cookies.set(cookieDetails); //Returns dict of created cookie

        if (result) {
            console.log(`Successfully neutralized cookie: ${result.name}`);
            await store(cookie); //Stores wiped cookie in recycling bin
        } else {
            console.warn(`Failed to wipe cookie ${cookieDetails.name}`);
        }

        return result;
    } catch (err) {
        console.error(`Failed to wipe cookie ${cookieDetails.name}:`, err);
        return null;
    }
}