//The recycling bin stores deleted cookies and ensures they don't reappear

//Exported functions

/**
 * Stores a cookie that has been deleted
 * @param {chrome.cookies.Cookie} cookie
 * @param {Bool} wiped - Whether the cookie was wiped rather than deleted
 * @returns {Promise<int>} - Index of the stored cookie, with a failure value of -1
 */
export async function store(cookie, wiped) {
    //Loads bins from local storage if they haven't been loaded yet
    if (deleteBin === null || wipeBin === null) await loadBins();
    try {
        const key = wiped ? "wipeBin" : "deleteBin";
        const selectedBin = wiped ? wipeBin : deleteBin;

        selectedBin.push(cookie);

        await chrome.storage.local.set({ [key] : selectedBin }); //Backups the updated bin in local storage

        return (wiped ? wipeBin : deleteBin).length - 1; //Returns last index where the cookie was pushed
    } catch (error) {
        console.error(`Error storing cookie ${cookie.name}: ${error}`);
        return -1;
    }
}

/**
 * Outputs total number of deleted cookies
 * @returns {Promise<int>} - Number of deleted cookies in bin
 */
export async function binSize() {
    if (deleteBin === null || wipeBin === null) await loadBins();
    return wipeBin.length + deleteBin.length;
}

/**
 * Fetches a deleted cookie
 * @param {String} idx - Cookie index
 * @param {Bool} wiped - Whether the cookie is from the wipe bin or delete bin
 * @param {Bool} del - Whether to delete the cookie after fetching it
 * @returns {Promise<chrome.cookies.Cookie | null>} - Cookie object or null if not found
 */
export async function get(idx, wiped, del = false) {
    //Loads bins from local storage if they haven't been loaded yet
    if (deleteBin === null || wipeBin === null) await loadBins();
    try {
        //Catches -1 idx values
        if (typeof idx !== 'number' || idx < 0) {
            console.error(`Invalid index ${idx} provided for cookie retrieval`);
            return null;
        }

        let cookie = null; //Cookie|Null //Fetch cookie by index
        
        //Check both bins for the cookie
        if (wiped && idx < wipeBin.length) cookie = wipeBin[idx];
        else if (!wiped && idx < deleteBin.length) cookie = deleteBin[idx];

        //Only deletes if cookie found
        if (del && cookie) {
            if (wiped) wipeBin.splice(idx, 1);
            else deleteBin.splice(idx, 1);
        }
        //THIS NEEDS TO UPDATE LOCAL STORAGE IF DELETED, OTHERWISE THE COOKIE WILL REAPPEAR ON RELOAD
        return cookie;
    } catch (error) {
        console.error(`Error fetching cookie at index ${idx}: ${error}`);
        return null;
    }
}

/**
 * Outputs all deleted cookies
 * @returns {Promise<chrome.cookies.Cookie[]>} - Array of deleted cookie objects
 */
export async function getAll() {
    if (deleteBin === null || wipeBin === null) await loadBins();
    return [...deleteBin, ...wipeBin];
}

/**
 * Checks whether an input cookie has already been deleted
 * @param {chrome.cookies.Cookie} cookie - Cookie object to be checked
 * @returns {Promise<Bool[2]>} - If cookie matches an existing cookie and whether it is from the wipe bin or delete bin
 */
export async function checkBin(cookie) {
    if (deleteBin === null || wipeBin === null) await loadBins();
    if (!cookie) {
        console.error("No cookie provided for bin check");
        return [false, false];
    }
    try {
        const inDeleteBin = deleteBin.some(c => checkCookieMatch(c, cookie));
        const inWipeBin = inDeleteBin ? false : wipeBin.some(c => checkCookieMatch(c, cookie)); //Only checks wipe bin if not in delete bin
        return [inDeleteBin || inWipeBin, inWipeBin]; //Either bin, specific bin
    } catch (error) {
        console.error(`Error checking cookie ${cookie.name} in bin: ${error}`);
        return [false, false];
    }
}

/**
 * Regenerates a deleted cookie
 * @param {String} idx - Index of the cookie to be regenerated
 * @param {Bool} wiped - Whether the cookie is from the wipe bin or delete bin
 * @returns {Promise<Bool>} - If cookie was successfully revived
 */
export async function regen(idx, wiped) {
    try {
        const cookie = await get(idx, wiped, false); //Doesn't delete cookie until regen success
        if (!cookie) {
            console.error(`Cookie at index ${idx} not found in bin`);
            return false;
        }
        if (!cookie.url) getURL(cookie); //Cookies are required to be set with a URL
        cleanCookie(cookie);
        await chrome.cookies.set(cookie);
        return true;
    } catch (error) {
        console.error(`Error regenerating cookie at index ${idx}: ${error}`);
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
    if (typeof cookie.secure !== 'boolean') {
        throw new TypeError(`Cookie ${cookie.name} is missing secure property`);
    }
    if (typeof cookie.path !== 'string' || cookie.path.trim() === '') {
        throw new TypeError(`Cookie ${cookie.name} is missing path property`);
    }
    if (typeof cookie.domain !== 'string' || cookie.domain.trim() === '') {
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
        if (deleteBin === null || wipeBin === null) {
            const result = await chrome.storage.local.get(["deleteBin", "wipeBin"]);
            deleteBin = result.deleteBin || []; //Grabs local storage data or inits empty array otherwise
            wipeBin = result.wipeBin || [];
            return true;
        }
    } catch (error) {
        console.error(`Error loading bins from local storage: ${error}`);
        deleteBin = deleteBin || []; //Inits empty array if local storage fails
        wipeBin = wipeBin || [];
        return false;
    }
}