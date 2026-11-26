import { purgeTracker, scanTracker } from "./deletion/deleterInMainWrld";

/**
 * Wrapper function for easy injection into a page. When page is loaded this script will immediately run.
 */
(function () {
    if (window.injectorLoaded) return;
    window.injectorLoaded = true;

    const cookiePatterns = [
        /session[-_]?id/i,
        /auth[-_]?token/i,
        /jwt/i,
        /bearer\s+[A-Za-z0-9]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_+/=]*/i,
        /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_+/=]*/
    ]

    /**
     * Is the pair of key value probably a cookie
     * @param {string} key
     * @param {any} value
     * @return {boolean}
     */
    function isPairProbablyTrackingCookie(key, value) {
        if (typeof value !== 'string') {
            return false;
        }
        const keyMatch = cookiePatterns.some((pattern) => pattern.test(key));
        const isJWT = /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/.test(value);
        const isCookieFormat = keyMatch || (value.includes('=') && value.includes(';'));

        return keyMatch || isJWT || isCookieFormat;
    }

    /**
     * Fires a SUSPICIOUS_COOKIE_DETECTED event when the cookie matches a series of RegEx patterns
     * @param type
     * @param {string} action
     * @param {string} key
     * @param value
     * @returns {Bool} - Whether the data isn't a tracker
     */
    async function fireSuspiciousStorageEvent(type, action, key, value) {
        if (await scanTracker(key)) return false; //Prevents tracker from spawning if found in blacklist/bin

        if (isPairProbablyTrackingCookie(key, value)) {
            console.warn(`[] ${type}.${action} detected a potential tracking cookie`);

            window.dispatchEvent(
                new CustomEvent('SUSPICIOUS_COOKIE_DETECTED', {
                    detail: {type, action, key, value, timestamp: Date.now()}
                })
            )
            return false;
        }

        return true;
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = async function (key, value) {
        const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
        if (await fireSuspiciousStorageEvent(storageType, 'setItem', key, value)) {
            return originalSetItem.apply(this, arguments);
        }
    }

    /**
     * Creates a storage proxy so all incoming and outgoing items can be scanned
     * @param target
     * @param type
     * @return {*|object|boolean}
     */
    function createStorageProxy(target, type) {
        return new Proxy(target, {
            set(obj, prop, value) {
                fireSuspiciousStorageEvent(type, 'propertyWrite', prop, value);
                obj[prop] = value;
                return true;
            },
            get(obj, prop) {
                const value = obj[prop];
                if (typeof value !== 'function' && typeof prop === 'string') {
                    fireSuspiciousStorageEvent(type, 'propertyRead', prop, value);
                }
                return typeof value === 'function' ? value.bind(obj) : value;
            }
        });
    }

    const localStorageProxy = createStorageProxy(window.localStorage, 'localStorage');
    const sessionStorageProxy = createStorageProxy(window.sessionStorage, 'sessionStorage');

    Object.defineProperty(window, 'localStorage', {
        get: () => localStorageProxy,
        configurable: true,
        enumerable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
        get: () => sessionStorageProxy,
        configurable: true,
        enumerable: true,
    });

    /**
     * Scans the entirety of the specified storage space for suspicious cookies
     * @param storage
     * @param type
     */
    async function storageScan(storage, type) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                const value = storage.getItem(key);
                if (!await fireSuspiciousStorageEvent(type, 'existingScan', key, value)) {
                    const response = await purgeTracker(storage, type === 'sessionStorage', key, true, true); //Deletes a found tracker without storing it
                    if (response) i--; //Decrements back as for loop is amended by deletion
                }
            }
        } catch (error) {
            console.error(`[]: An error occurred during an storage scan
${error.message}`);
        }
    }

    storageScan(window.localStorage, 'localStorage');
    storageScan(window.sessionStorage, 'sessionStorage');

    //Received from tabWorker.js
    //Deletes tracker
    window.addEventListener("DELETE_TRACKER_TO_MAIN", (event) => {
        const { key, strict } = event.detail;
        //Deletes trackers from both storages
        const deletedLocal = purgeTracker(window.localStorage, false, key, strict, false);
        const deletedSession = purgeTracker(window.sessionStorage, true, key, strict, false);
        window.dispatchEvent(
            new CustomEvent("DELETION_STATUS_TO_ISOLATED", {
                detail: {
                    datatype: "tracker",
                    success: deletedLocal || deletedSession //Deletion occurred in either
                }
            })
        );
    });
    //Adds data back to storage
    window.addEventListener("ADD_TO_MAIN", async (event) => {
        const { key, value, storeType } = event.detail;

        let success = false; //Bool
        try {
            const storage = storeType ? window.sessionStorage : window.localStorage;
            await storage.setItem(key, value); //Setting is async with proxy
            success = storage.getItem(key) !== null; //Success if entry can be found again
        } catch (err) {
            console.error(`Failed to add ${key} : ${value} to ${storeType ? "session" : "local"} storage: `, err);
        }

        //Sends success flag back to recyclingBin.js
        window.dispatchEvent(
            new CustomEvent("ADDITION_STATUS_TO_ISOLATED", {
                detail: { success }
            })
        );
    });
})();

