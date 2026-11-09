//The recycling bin stores deleted cookies and ensures they don't reappear

//Exported functions

/**
 * Stores a cookie that has been deleted
 * @param {chrome.cookies.Cookie} cookie
 * @returns {Promise<int>} - Index of the stored cookie, with a failure value of -1
 */
export async function store(cookie) {
    try {
        bin.push(cookie);
        return bin.length - 1; //Returns last index where the cookie was pushed
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
 * @param {String} idx - Cookie index
 * @param {Bool} del - Whether to delete the cookie after fetching it
 * @returns {Promise<chrome.cookies.Cookie | null>} - Cookie object or null if not found
 */
export async function get(idx, del = false) {
    try {
        let cookie = bin[idx] || null; //Cookie|Null //Fetch cookie by index
        //Only deletes if cookie found
        if (del && cookie) bin.splice(idx, 1); //Deletes cookie from bin
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

/**
 * Regenerates a deleted cookie
 * @param {String} idx - Index of the cookie to be regenerated
 * @returns {Promise<Bool>} - If cookie was successfully revived
 */
export async function regen(idx) {
    try {
        const cookie = await get(idx, false); //Doesn't delete cookie until regen success
        if (!cookie) {
            console.error(`Cookie at index ${idx} not found in bin`);
            return false;
        }

        await chrome.cookies.set(cookie);

        return true;
    } catch (error) {
        console.error(`Error regenerating cookie at index ${idx}: ${error}`);
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