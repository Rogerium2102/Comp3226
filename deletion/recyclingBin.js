//NEED TO CREATE SYSTEM FOR ID TRACING OF COOKIES

//Exported functions

/**
 * Stores a cookie that has been deleted
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<int>} - ID of the stored cookie, with a failure value of -1
 */
export async function store(cookie) {
    try {
        //Generate a unique ID for the cookie if it doesn't have one
        if (!cookie.id) {
            cookie.id = `${cookie.name}-${cookie.domain}-${cookie.path}-${Date.now()}`;
        }
        bin.push(cookie);
        return cookie.id;
    } catch (error) {
        console.error(`Error storing cookie ${cookie.name}: ${error}`);
        return -1;
    }
}

/**
 * Outputs number of deleted cookies
 * @returns {Promise<int>} - Number of deleted cookies in bin
 */
export async function binSize() {
    return bin.length;
}

/**
 * Fetches a deleted cookie
 * @param {String} id - Cookie ID
 * @param {Bool} del - Whether to delete the cookie after fetching it
 * @returns {Promise<chrome.cookies.Cookie | null>} - Cookie object or null if not found
 */
export async function get(id, del) {
    try {
        let cookie = bin.find(cookie => cookie.id === id) || null; //Cookie|Null //Ensure cookies have IDs
        //Only deletes if cookie found
        if (del && cookie) bin = bin.filter(cookie => cookie.id !== id);
        return cookie;
    } catch (error) {
        console.error(`Error fetching cookie with ID ${id}: ${error}`);
        return null;
    }
}

/**
 * Outputs IDs of all deleted cookies
 * MIGHT LEAK TOO MUCH DATA DUE TO ABILITY TO SCAN ENTIRE BIN WITH THIS
 * @returns {Promise<String[]>} - Array of cookie IDs
 */
export async function getIDs() {
    return bin.map(cookie => cookie.id);
}

/**
 * Outputs all deleted cookies
 * MIGHT LEAK TOO MUCH DATA DUE TO ABILITY TO SCAN ENTIRE BIN WITH THIS
 * @returns {Promise<chrome.cookies.Cookie[]>} - Array of deleted cookie objects
 */
export async function getAll() {
    return bin;
}

/**
 * Checks whether an input cookie has already been deleted
 * @param {chrome.cookies.Cookie} cookie - Cookie object to be checked
 * @returns {Promise<Bool>} - If cookie matches an existing cookie in the bin
 */
export async function checkBin(cookie) {
    if (!cookie) {
        console.error("No cookie provided for bin check");
        return false;
    }
    try {
        return bin.some(c => checkCookieMatch(c, cookie));
    } catch (error) {
        console.error(`Error checking cookie ${cookie.name} in bin: ${error}`);
        return false;
    }
}

//Local functions

let bin = [] //List[Cookie] //Recycling bin for deleted cookies

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