import {store, getURL, cleanCookie} from './recyclingBin.js';

/**
 * Deletes all cookies passed to it
 * @param {chrome.cookies.Cookie[]} cookies - List of cookie objects to be deleted
 * @returns {Promise<Bool>} - Success flag
 */
export async function purgeCookies(cookies) {
    try {
        //Runs all deletions in parallel & pauses until they are completed
        const results = await Promise.allSettled(cookies.map(cookie => purgeCookie(cookie))); //List[{name, url, storeId}]
        let allSuccess = true; //Bool //Whether all deletions successfully went through

        results.forEach((element, idx) => {
            if (element.status === "rejected") { //Error in purgeCookie
                console.error(`Failed to delete cookie ${cookies[idx].name}`);
                allSuccess = false;
            } else if (element.value === null) { //Null return of purgeCookie
                console.warn(`Cookie ${cookies[idx].name} was not found`);
                allSuccess = false;
            }
        });
        return allSuccess;

    } catch (err) {
        console.error(`Failed to delete cookies`, err);
        return false;
    }
}

/**
 * Wipes all cookies passed to it
 * @param {chrome.cookies.Cookie[]} cookies - List of cookie objects to be wiped
 * @returns {Promise<Bool>} - Success flag
 */
export async function wipeCookies(cookies) {
    try {
        //Runs all wipes in parallel & pauses until they are completed
        const results = await Promise.allSettled(cookies.map(cookie => wipeCookie(cookie))); //List[Dict]
        let allSuccess = true; //Bool //Whether all deletions successfully went through

        results.forEach((element, idx) => {
            if (element.status === "rejected") { //Error in wipeCookie
                console.error(`Failed to wipe cookie ${cookies[idx].name}`);
                allSuccess = false;
            } else if (element.value === null) { //Null return of wipeCookie
                console.warn(`Cookie ${cookies[idx].name} was not found`);
                allSuccess = false;
            }
        });
        return allSuccess;

    } catch (err) {
        console.error(`Failed to wipe cookies`, err);
        return false;
    }
}

/**
 * Deletes a specific cookie from the browser
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<chrome.cookies.Cookie | null>}
 */
export async function purgeCookie(cookie) {
    try {
        //Constructs separate cookie, prevents sending out unnecessary user details
        const cookieDetails = {
            name: cookie.name,
            url: getURL(cookie)
        };

        //Optional Params to ensure cookie is correct
        if (cookie.storeId)         cookieDetails.storeId = cookie.storeId;
        if (cookie.partitionKey)    cookieDetails.partitionKey = cookie.partitionKey;
        if (cookie.firstPartyDomain)cookieDetails.firstPartyDomain = cookie.firstPartyDomain;
    
        const result = await chrome.cookies.remove(cookieDetails); //{name, url, storeId}

        if (result) {
            console.log(`Successfully deleted cookie: ${result.name}`);
            await store(cookie, false); //Stores deleted cookie in recycling bin
        } else {
            console.warn(`Failed to delete cookie ${cookie.name}`);
        }

        return result;
    } catch (err) {
        console.error(`Failed to delete cookie ${cookie.name}:`, err);
        return null;
    }
}

/**
 * //Wipes the value of a cookie to prevent it from tracking a user
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<chrome.cookies.Cookie | null>}
 */
export async function wipeCookie(cookie) {
    try {
        let cookieDetails = {...cookie}; //Creates shallow copy of cookie for editing
        getURL(cookieDetails);
        cookieDetails.value = "0"; //Wipes tracking value with truthy value

        cleanCookie(cookieDetails)

        const result = await chrome.cookies.set(cookieDetails); //Returns dict of created cookie

        if (result) {
            console.log(`Successfully neutralized cookie: ${result.name}`);
            await store(cookie, true); //Stores wiped cookie in recycling bin
        } else {
            console.warn(`Failed to wipe cookie ${cookieDetails.name}`);
        }

        return result;
    } catch (err) {
        console.error(`Failed to wipe cookie ${cookieDetails.name}:`, err);
        return null;
    }
}