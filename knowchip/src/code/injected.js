/**
 * Wrapper function for easy injection into a page. When page is loaded this script will immediately run.
 */
(function () {
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
     */
    function fireSuspiciousStorageEvent(type, action, key, value) {
        if (isPairProbablyTrackingCookie(key, value)) {
            console.warn(`[] ${type}.${action} detected a potential tracking cookie`);

            window.dispatchEvent(
                new CustomEvent('SUSPICIOUS_COOKIE_DETECTED', {
                    detail: {type, action, key, value, timestamp: Date.now()}
                })
            )
        }
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
        fireSuspiciousStorageEvent(storageType, 'setItem', key, value);
        return originalSetItem.apply(this, arguments);
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
    function storageScan(storage, type) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                const value = storage.getItem(key);
                fireSuspiciousStorageEvent(type, 'existingScan', key, value);
            }
        } catch (error) {
            console.error(`[]: An error occured during an storage scan
${error.message}`);
        }
    }

    storageScan(window.localStorage, 'localStorage');
    storageScan(window.sessionStorage, 'sessionStorage');
})();

