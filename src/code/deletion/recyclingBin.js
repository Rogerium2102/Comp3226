//NEED TO CREATE SYSTEM FOR ID TRACING OF COOKIES

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

let bin = [] //List[Cookie] //Recycling bin for deleted cookies