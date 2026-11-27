import {store, getURL, cleanCookie, enterBlacklist} from './recyclingBin.js';

/**
 * Deletes all cookies passed to it
 * @param {chrome.cookies.Cookie[]} cookies - List of cookie objects to be deleted
 * @returns {Promise<Bool>} - Success flag
 */
export async function purgeCookies(cookies) {
    return batchHandle(cookies, false);
}

/**
 * Wipes all cookies passed to it
 * @param {chrome.cookies.Cookie[]} cookies - List of cookie objects to be wiped
 * @returns {Promise<Bool>} - Success flag
 */
export async function wipeCookies(cookies) {
    return batchHandle(cookies, true);
}

/**
 * Applies wiping or purging operation on a list of cookies
 * @param {chrome.cookies.Cookie[]} cookies
 * @param {Bool} isWiping - Operation being applied
 * @returns {Promise<Bool>} - Success flag
 */
async function batchHandle(cookies, isWiping) {
    const opMsg = isWiping ? "wiping" : "deleting";
    const opFunc = isWiping ? wipeCookie : purgeCookie;
    try {
        //Runs all wipes in parallel & pauses until they are completed
        const results = await Promise.allSettled(cookies.map(cookie => opFunc(cookie))); //Dict
        const totalNum = results.length; //int //Stores all results (avoids duplicating array twice)
        const failNum = results.filter(r => r.status === "rejected" || r.value === false).length; //int //Number of failed deletions

        const msg = `Cookie ${opMsg} completed on ${totalNum} entries with ${totalNum-failNum} successes and ${failNum} failures.`;
        failNum === 0 ? console.log(msg) : console.warn(msg);

        return failNum === 0;
    } catch (err) {
        console.error(`${opMsg} cookies failed: `, err);
        return false;
    }
}

/**
 * Deletes a specific cookie from the browser
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<Bool>}
 */
export async function purgeCookie(cookie) {
    try {
        if (!rateLimiter([cookie.name, cookie.domain])) return false; //Rate limited

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
            return true;
        } else {
            console.warn(`Failed to delete cookie ${cookie.name}`);
            return false;
        }
    } catch (err) {
        console.error(`Failed to delete cookie ${cookie?.name}:`, err);
        return false;
    }
}

/**
 * Wipes the value of a cookie to prevent it from tracking a user
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<Bool>}
 */
export async function wipeCookie(cookie) {
    try {
        if (!rateLimiter([cookie.name, cookie.domain])) return false;

        let cookieDetails = {...cookie}; //Creates shallow copy of cookie for editing
        getURL(cookieDetails);
        cookieDetails.value = "0"; //Wipes tracking value with truthy value

        cleanCookie(cookieDetails)

        const result = await chrome.cookies.set(cookieDetails); //Returns dict of created cookie

        if (result) {
            console.log(`Successfully neutralized cookie: ${result.name}`);
            await store(cookie, true); //Stores wiped cookie in recycling bin
            return true;
        } else {
            console.warn(`Failed to wipe cookie ${cookieDetails.name}`);
            return false;
        }
    } catch (err) {
        console.error(`Failed to wipe cookie ${cookie?.name}:`, err);
        return false;
    }
}

/**
 * Deletes a specific tracker (HAS TO RUN IN EXTENSION WORLD)
 * @param {string} key - Tracker name to delete
 * @param {Bool} equals - Whether deleted trackers should be equal to or containing the input name
 * @param {Bool} blacklist - Whether deleted trackers should be inserted into the recycling bin
 * @returns {Promise<Bool>} - Success flag
 */
export async function requestTrackerDeletion(key, equals = true, blacklist = true) {
    try {
        if (!rateLimiter(key)) return false;

        const success = await messageIsolated("REQUEST_DELETION_TO_ISOLATED", {
            datatype: "tracker",
            key: key,
            strict: equals
        });

        if (success && blacklist) await enterBlacklist(key, equals);

        return success; 
    } catch (err) {
        console.error(`Failed to delete tracker ${key}:`, err);
        return false;
    }
}

/**
 * Passes a message to ISOLATED world
 * Has to be received by tabWorker.js and passed to MAIN
 * HAS TO RUN IN EXTENSION WORLD
 * @param {string} code - Message code to identify message by tabWorker.js
 * @param {Dict} content - Message content that is directly passed through
 * @returns {Promise<Bool>} - Success flag
 */
export async function messageIsolated(code, content = {}) {
    try {
        //Fetches tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url?.startsWith('http')) { //Validates tab fetch
            console.error("TabWorker not found");
            return false;
        }

        //Sends response through tabWorker -> deleterInMainWrld
        const payload = { ...content, type: code}; //Shallow copy of content with code added, prevents permanent mutation of content
        const response = await chrome.tabs.sendMessage(tab.id, payload);

        return Boolean(response?.success) //Boolean(undefined) = false
    } catch (err) {
        console.log(`Failed to send ${code} with content: ${content}, to tabWorker.js: `, err);
        return false;
    }
}


let holder = {} //Dict{key : quantity} //Holds deleted keys and times deleted to check for repeated deletions
let limitCalmer = null; //Interval to calm the rate limiter down to decrement values to prevent valid deletions from being forbidden
const limitNum = 10; //Max limit until blocking repeated deletions
const calmRate = 1000; //ms between

/**
 * Inputs a deletion and checks if it can be approved or needs to be denied
 * @param {List | string} deletedObj - Unique identifying data input as either as a string or as a list of unique fields
 * @returns {Bool} - Success flag
 */
export function rateLimiter(deletedObj) {
    if (!holder) holder = {};

    const key = typeof deletedObj === "string" ? deletedObj : deletedObj.join('-'); //Packs input data into unique string key

    const recentDeletions = holder[key] ?? 0; //If value not found with key, defaults to 0 occurances
    if (recentDeletions === limitNum) {
        holder[key] = recentDeletions + 10; //Enforces wait until deletion retry
        return false;

    } else if (recentDeletions > limitNum) {
        //Printing anything here could overwhelm browser
        //console.warn(`Automatic deletion of tracker ${key} has been rate limited`);
        return false;
        
    } else {
        holder[key] = recentDeletions + 1;
        return true;
    }
}

/**
 * Handles rate limiter by decrementing entries and printing statuses
 * Needs to be called in background.js to establish listeners
 * Creates a continous polling interval
 */
export function rateLimiterMaster() {
    if (!holder) holder = {};
    if (limitCalmer !== null) return; //Don't create duplicate intervals

    limitCalmer = setInterval(() => {
        for (const key in holder) {
            holder[key] = holder[key] - 1;
            if (holder[key] <= 0) delete holder[key]; //Cleans empty keys
        }
    }, calmRate);
}

/**
 * Returns all currently rate limited keys
 * @returns {List[String]}
 */
export function checkRateLimiter() {
    if (!holder) return;

    const limited = [];
    for (const key in holder) {
        if (holder[key] >= limitNum) limited.push(key);
    }
    return limited;
}