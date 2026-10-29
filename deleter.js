//Deletes all cookies passed to it
//List[Dict] -> Bool
export async function purgeCookies(cookies) {
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
}

//Wipes all cookies passed to it
//List[Dict] -> Bool
export async function wipeCookies(cookies) {
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
}


//Takes pulled cookie data and constructs its URL
//Dict -> String
function getURL(cookie) {
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

//Deletes a specific cookie from the browser
//Dict -> {String, String, String} | Null
async function purgeCookie(cookie) {

    //Constructs separate cookie, prevents sending out unnecessary user details
    const cookieDetails = {
        name: cookie.name,
        url: getURL(cookie)
    };

    //Optional Params to ensure cookie is correct
    if (cookie.storeId)         cookieDetails.storeId = cookie.storeId;
    if (cookie.partitionKey)    cookieDetails.partitionKey = cookie.partitionKey;
    if (cookie.firstPartyDomain)cookieDetails.firstPartyDomain = cookie.firstPartyDomain;
    
    try {
        const result = await chrome.cookies.remove(cookieDetails); //{name, url, storeId}

        if (result) {
            console.log(`Successfully deleted cookie: ${result.name}`);
        } else {
            console.warn(`Failed to delete cookie ${cookie.name}`);
        }

        return result;
    } catch (err) {
        console.error(`Failed to delete cookie ${cookie.name}:`, err);
        return null;
    }
}

//Wipes the value of a cookie to prevent it from tracking a user
//Dict -> Dict | Null
async function wipeCookie(cookie) {
    let cookieDetails = cookie;
    getURL(cookieDetails);
    cookieDetails.value = "0"; //Wipes tracking value with truthy value

    //Removes domain if host-only
    if (cookieDetails.domain && cookieDetails.hostOnly) cookieDetails.domain = undefined;
    //Unspecified value will error when setting a cookie
    if (cookie.sameSite == "unspecified") cookie.sameSite = undefined

    try {
        const result = await chrome.cookies.set(cookieDetails); //Returns dict of created cookie

        if (result) {
            console.log(`Successfully neutralized cookie: ${result.name}`);
        } else {
            console.warn(`Failed to wipe cookie ${cookie.name}`);
        }

        return result;
    } catch (err) {
        console.error(`Failed to wipe cookie ${cookie.name}:`, err);
        return null;
    }
}