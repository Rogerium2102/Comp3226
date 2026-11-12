//The recycling bin stores deleted cookies and ensures they don't reappear

import { purgeCookie, wipeCookie } from "./cookieDeleter";

//Exported functions

/**
 * Stores a cookie/tracker that has been deleted
 * @param {chrome.cookies.Cookie | String} entry
 * @param {Bool} wiped - Whether the cookie was wiped rather than deleted
 * @returns {Promise<int>} - Index of the stored cookie, with a failure value of -1
 */
export async function store(entry, wiped) {
    let isCookie; //Bool
    let name; //String //Error output
    try {
        isCookie = !(typeof entry === "string");
        name = isCookie ? entry.name : entry;
    } catch (err) {
        console.error(`Invalid entry input to store: ${err}`);
        return -1;
    }

    //Loads bins from local storage if they haven't been loaded yet
    if (deleteBin === null || wipeBin === null || trackerBin === null) await loadBins();
    try {
        const { key, selectedBin } = getKeys(isCookie, wiped);

        selectedBin.push(entry);

        await chrome.storage.local.set({ [key] : selectedBin }); //Backups the updated bin in local storage

        return selectedBin.length - 1; //Returns last index where the cookie was pushed
    } catch (err) {
        console.error(`Error storing ${isCookie ? "cookie" : "tracker"} ${name}: ${err}`);
        return -1;
    }
}

/**
 * Outputs total number of deleted cookies
 * @param {Bool} isCookie - Whether a cookie or a tracker needs to be grabbed
 * @param {Bool} wiped - Whether the cookie is from the wipe bin or delete bin
 * @returns {Promise<int>} - Number of deleted cookies in bin
 */
export async function binSize(isCookie, wiped = false) {
    if (deleteBin === null || wipeBin === null || trackerBin === null) await loadBins();
    if (isCookie) {
        if (wiped)  return wipeBin.length;
        else        return deleteBin.length;
    } else          return trackerBin.length;
}

/**
 * Fetches a deleted cookie/tracker
 * @param {String} idx - Cookie/Tracker index
 * @param {Bool} isCookie - Whether a cookie or a tracker needs to be grabbed
 * @param {Bool} wiped - Whether the cookie is from the wipe bin or delete bin
 * @param {Bool} del - Whether to delete the cookie/tracker after fetching it
 * @returns {Promise<chrome.cookies.Cookie | null>} - Cookie object or null if not found
 */
export async function get(idx, isCookie, wiped = false, del = false) {
    //Loads bins from local storage if they haven't been loaded yet
    if (deleteBin === null || wipeBin === null || trackerBin === null) await loadBins();
    try {
        const { key, selectedBin } = getKeys(isCookie, wiped);
        //Catches -1 idx values
        if (typeof idx !== "number" || idx < 0) {
            console.error(`Invalid index ${idx} provided for cookie retrieval`);
            return null;
        }

        let entry = null; //Cookie|String|Null //Fetch cookie/tracker by index
        
        //Check both bins for the cookie
        if (idx < selectedBin.length) entry = selectedBin[idx];

        //Only deletes if cookie found
        if (del && entry) await removeEntry(idx, key, selectedBin);

        return entry;
    } catch (err) {
        console.error(`Error fetching cookie at index ${idx}: ${err}`);
        return null;
    }
}

/**
 * Outputs all deleted cookies
 * @returns {Promise<chrome.cookies.Cookie[]>} - Array of deleted cookie objects
 */
export async function getCookies() {
    if (deleteBin === null || wipeBin === null) await loadBins();
    return [...deleteBin, ...wipeBin];
}

/**
 * Outputs all deleted trackers
 * @returns {Promise<String[]>} - Array of deleted tracker objects
 */
export async function getTrackers() {
    if (trackerBin === null) await loadBins();
    return trackerBin;
}

/**
 * Checks whether an input cookie/tracker has already been deleted
 * @param {chrome.cookies.Cookie | String} entry - Cookie/tracker object to be checked
 * @returns {Promise<Dict>} - Holds match flag and function to erase cookie if true
 */
export async function checkBin(entry) {
    if (deleteBin === null || wipeBin === null || trackerBin === null) await loadBins();
    if (!entry) {
        console.error("No value provided for bin check");
        return { match : false, func : null };
    }
    const name = typeof entry === "string" ? entry : entry.name; //Error response name
    try {
        if (typeof entry === "string") {
            //Tracker
            if (trackerBin.some(t => t === entry)) return { match : true, func : null }; //Func is null in lieu of tracking deletion function
            else return { match : false, func : null }; 
        } else {
            //Cookies
            const inDeleteBin = deleteBin.some(c => checkCookieMatch(c, entry));
            const inWipeBin = inDeleteBin ? false : wipeBin.some(c => checkCookieMatch(c, entry)); //Only checks wipe bin if not in delete bin

            if (inDeleteBin || inWipeBin) {
                const nextFunc = inDeleteBin ? purgeCookie : wipeCookie;
                return { match : true, func : nextFunc };
            } else {
                return { match : false, func : null };
            }
        }
    } catch (err) {
        console.error(`Error checking cookie ${name} in bin: ${err}`);
        return { match : false, func : null };
    }
}

/**
 * Regenerates a deleted cookie/tracker
 * @param {String} idx - Index of the cookie/tracker to be regenerated
 * @param {Bool} isCookie - Whether a cookie or a tracker needs to be regened
 * @param {Bool} wiped - Whether the cookie is from the wipe bin or delete bin
 * @returns {Promise<Bool>} - If cookie/tracker was successfully revived
 */
export async function regen(idx, isCookie, wiped = false) {
    try {
        const entry = await get(idx, isCookie, wiped, false); //Doesn't delete cookie until regen success
        if (!entry) {
            console.error(`Entry at index ${idx} not found in bin`);
            return false;
        }

        if (isCookie) {
            if (!entry.url) getURL(entry); //Cookies are required to be set with a URL
            cleanCookie(entry);
            await chrome.cookies.set(entry);
        } else {
            console.error(`Regenerating trackers not implemented`);
            return false
        }

        const { key, selectedBin } = getKeys(isCookie, wiped);
        await removeEntry(idx, key, selectedBin); //Deletes cookie from bin only after success

        return true;
    } catch (err) {
        console.error(`Error regenerating cookie/tracker at index ${idx}: ${err}`);
        return false;
    }
}

/**
 * Inserts a URL property into an input cookie
 * @param {chrome.cookies.Cookie} cookie - Cookie object to be modified
 * @returns {String} - Constructed URL
 */
export function getURL(cookie) {
    if (cookie.url) return cookie.url;

    //Validation
    if (typeof cookie.secure !== "boolean") {
        throw new TypeError(`Cookie ${cookie.name} is missing secure property`);
    }
    if (typeof cookie.path !== "string" || cookie.path.trim() === "") {
        throw new TypeError(`Cookie ${cookie.name} is missing path property`);
    }
    if (typeof cookie.domain !== "string" || cookie.domain.trim() === "") {
        throw new TypeError(`Cookie ${cookie.name} is missing domain property`);
    }

    //Data retrieval
    const protocol = cookie.secure ? 'https://' : 'http://'; //String //Assumes non secure if undefined
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain; //String //Cuts preceding dot from domain
    const path = cookie.path.startsWith('/') ? cookie.path : '/' + cookie.path; //String //Ensures a preceding / exists infront of the path

    const constructURL = protocol + domain + path; //String
    cookie.url = constructURL;
    return constructURL;
}

/**
 * Cleans fields from cookies with invalid values for setting
 * @param {chrome.cookies.Cookie} cookie - Cookie object to be modified
 * @returns {Bool} - Success flag
 */
export function cleanCookie(cookie) {
    try {
        //Cookie retrieval adds domain to host-only cookies, if domain set then it will be treated as a new cookie
        if (cookie.domain && cookie.hostOnly) delete cookie.domain;
        //Unspecified value will error when setting a cookie
        if (cookie.sameSite == "unspecified") delete cookie.sameSite;

        delete cookie.hostOnly;
        delete cookie.session;
        delete cookie.id;

        return true;
    } catch (err) {
        console.error(`Error cleaning cookies: ${err}`);
        return false;
    }
}

//Local functions

let deleteBin = null //List[Cookie] //Recycling bin for deleted cookies
let wipeBin = null //List[Cookie] //Recycling bin for wiped cookies
let trackerBin = null //List[String] //Recycling bin for deleted tracker keys (there's no point in wiping trackers)

/**
 * Checks if a cookie matches another cookie
 * @param {chrome.cookies.Cookie} cookie1
 * @param {chrome.cookies.Cookie} cookie2
 * @returns {Bool}
 */
function checkCookieMatch(cookie1, cookie2) {
    if (!cookie1 || !cookie2) return false; //Safety check for missing input
    //Name and path must match for cookies to be the same
    if (cookie1.name !== cookie2.name) return false;
    if (cookie1.path !== cookie2.path) return false;

    if (normaliseDomain(cookie1.domain) !== normaliseDomain(cookie2.domain)) return false;
    if (normalisePartitionKey(cookie1.partitionKey) !== normalisePartitionKey(cookie2.partitionKey)) return false;
    return true;
}

/**
 * Standardises the domain property of a cookie
 * @param {String | null} domain
 * @returns {String | null}
 */
function normaliseDomain(domain) {
    if (!domain) return null;
    //Cuts off leading dot and converts to lowercase as they are case insensitive
    return domain.startsWith(".") ? domain.slice(1).toLowerCase() : domain.toLowerCase();
}

/**
 * Standardises the partitionKey property of a cookie
 * @param {Object | String | null | undefined} partitionKey
 * @returns {String | null}
 */
function normalisePartitionKey(partitionKey) {
    if (!partitionKey) return null;
    if (typeof partitionKey === "string") return partitionKey; //No reformatting needed
    return partitionKey.topLevelSite || null; //Extracts topLevelSite from object if object
}

/**
 * Loads delete and wiped bins from local storage
 * @returns {Promise<Bool>}
 */
async function loadBins() {
    try {
        if (deleteBin === null || wipeBin === null || trackerBin === null) {
            const result = await chrome.storage.local.get(["deleteBin", "wipeBin", "trackerBin"]);
            deleteBin = result.deleteBin || []; //Grabs local storage data or inits empty array otherwise
            wipeBin = result.wipeBin || [];
            trackerBin = result.trackerBin || [];
            return true;
        }
    } catch (err) {
        console.error(`Error loading bins from local storage: ${err}`);
        deleteBin = deleteBin || []; //Inits empty array if local storage fails
        wipeBin = wipeBin || [];
        trackerBin = trackerBin || [];
        return false;
    }
}

/**
 * Gets data to push cookie bins to local storage
 * @param {Bool} isCookie
 * @param {Bool} wiped
 * @returns {Dict} - Returns storage key and local cookies to push
 */
function getKeys(isCookie, wiped) {
    return {
        key : (isCookie ? (wiped ? "wipeBin" : "deleteBin") : "trackerBin"),
        selectedBin : (isCookie ? (wiped ? wipeBin : deleteBin) : trackerBin)
    };
}

/**
 * Removes a cookie/tracker from memory and local storage
 * @param {int} idx
 * @param {string} key
 * @param {List[Cookie]} selectedBin
 * @returns {Promise<Bool>} - Success flag
 */
async function removeEntry(idx, key, selectedBin) {
    try {
        selectedBin.splice(idx, 1);
        //Pushes whole updated bin to storage (can't select one to delete)
        await chrome.storage.local.set({ [key] : selectedBin });
        return true;
    } catch (err) {
        console.error(`Error deleting cookie from bin: ${err}`);
        return false;
    }
}