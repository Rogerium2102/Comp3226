/**
 * Deletes a specific tracker from storages (RUNS IN MAIN AND ISOLATED WORLDS)
 * @param {Object} storageObj - Imported local storage from site
 * @param {Bool} isSessionStorage - Whether the storage is session or local storage
 * @param {string} key - Tracker name to delete
 * @param {boolean} equals - Whether to match the key exactly or partially
 * @param {boolean} bin - Whether to store deleted tracker in bin
 * @returns {boolean} - If any deletions occurred
 */
export function purgeTracker(storageObj, isSessionStorage, key, equals = false, bin = true) {
    try {
        //Validate storage object
        if (!storageObj || typeof storageObj.removeItem !== 'function') {
            console.error("Invalid storage object passed to purgeTracker");
            return false;
        }

        //Finds trackers in storage
        let searchTrackers = []; //List[Dict]
        if (equals) {
            //Only adds tracker if storage contains it
            const item = storageObj.getItem(key);
            if (item !== null) searchTrackers = [{"key" : key, "value" : item, "storeType" : isSessionStorage}];
        } else {
            for (let i = 0; i < storageObj.length; i++) { //Searches all items in storage
                const k = storageObj.key(i);
                //Adds scanned object if it contains the key
                if (k && k.includes(key)) searchTrackers.push({"key" : k, "value" : storageObj.getItem(k), "storeType" : isSessionStorage});
            }
        }

        //Exits is no found trackers
        if (searchTrackers.length < 1) {
            console.log(`No trackers found ${equals ? "matching" : "containing"} ${key}`);
            return false;
        }

        //Removes object from storage
        for (const t of searchTrackers) {
            storageObj.removeItem(t.key); //RemoveItem is synchronous so no need to await it
        }
        //Fires event to add tracker to bin
        if (bin) {
            //PurgeTracker runs in MAIN world, whereas store needs to run in extension world to access extension storage
            //This passes it to comms.js which is in ISOLATED world
            window.dispatchEvent(
                new CustomEvent("DELETED_TRACKERS_TO_ISOLATED", {
                    detail: { trackers: searchTrackers }
                })
            );
        }

        return true;
    } catch (err) {
        console.error(`Failed to delete tracker storage value ${equals ? "matching" : "containing"} ${key}:`, err);
        return false;
    }
}

/**
 * //Scans a specific tracker to see if its present in recycling bin (RUNS IN MAIN WORLD)
 * @param {string} key - Tracker name to delete
 * @param {Object} storageObj - Imported local storage from site, not required if no deletion required
 * @param {Bool} isSessionStorage - Whether the storage is session or local storage
 * @returns {Promise<boolean>}
 */
export async function scanTracker(key, storageObj = null, isSessionStorage = true) {
    try {
        const status = await new Promise((callback) => {
            //Receives status of checked tracker name
            const listenerName = "BLACKLIST_STATUS_TO_MAIN";
            window.addEventListener(listenerName, function handler(event){
                if (event.detail?.key === key) {
                    window.removeEventListener(listenerName, handler);
                    callback(Number(event.detail.status));
                }
            });

            //Sends tracker name to recyclingBin.js through comms.js
            window.dispatchEvent(
                new CustomEvent("CHECK_TRACKER_TO_ISOLATED", {
                    detail: { key: key }
                })
            );
        });

        if (storageObj) {
            switch (status) {
                case 0: //No match
                    return false;
                case 1: //Match in recycling bin
                    return purgeTracker(storageObj, isSessionStorage, key, true, false);
                case 2: //Match in blacklist
                    return purgeTracker(storageObj, isSessionStorage, key, true, true); //Places tracker in bin
                default:
                    console.error(`Incorrect status (${status}) return from ${key}`);
                    return false;
            }
        } else {
            if (status < 0) {
                console.error(`Incorrect status (${status}) return from ${key}`);
                return false;
            } else return status !== 0;
        }
        
    } catch (err) {
        console.error(`Failed to scan tracker ${key}:`, err);
        return false;
    }
}