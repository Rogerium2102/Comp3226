async function getAllCookiesInternal() {
    try {
        const cookies = await chrome.cookies.getAll({});
        return cookies || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let memoryCache = [];
let cacheExpiry = 0;

export async function getAllCookies() {
    try {
        const now = Date.now();
        if (memoryCache.length > 0 && now < cacheExpiry) {
            return memoryCache;
        }
        const data = await chrome.storage.session.get("sessionExpiry, sessionCookies");
        if (data.sessionCookies && data.sessionExpiry && now < data.sessionExpiry) {
            memoryCache = data.sessionCookies;
            cacheExpiry = data.sessionExpiry;
            return data.sessionCookies;
        }
        const cookies = await getAllCookiesInternal();
        const newExpiry = now + CACHE_TTL_MS;
        memoryCache = cookies;
        cacheExpiry = newExpiry;
        await chrome.storage.session.set({
            sessionCookies: cookies,
            sessionExpiry: newExpiry,
        });
        return cookies || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function getCookieByName(name) {
    const cookies = await getAllCookies();
    return cookies.find(cookie => cookie.name === name);
}

export async function getCookiesByDomain(domain) {
    const cookies = await getAllCookies();
    return cookies.filter(cookie => cookie.domain === domain);
}

export async function getCookiesByExpiringWithinDays(days) {
    const cookies = await getAllCookies();
    const nowInSeconds = Date.now() / 1000;
    const maxExpiration = nowInSeconds + (days * 24 * 60 * 60);
    return cookies.filter(cookie => {
        if (!cookie.expirationDate) return false;
        return cookie.expirationDate > nowInSeconds && cookie.expirationDate < maxExpiration;
    });
}

export async function getCookiesByPredicate(predicate) {
    const cookies = await getAllCookies();
    return cookies.filter(predicate);
}
