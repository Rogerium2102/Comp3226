/**
 * Deletes a specific tracker from storages (HAS TO RUN IN MAIN WORLD)
 * @param {Object} storageObj - Imported local storage from site
 * @param {string} key - Tracker name to delete
 * @param {Bool} equals - Whether to match the key exactly or partially
 * @param {Bool} blacklist - Whether to store deleted tracker in bin
 * @returns {Bool} - If any deletions occurred
 */
export function purgeTracker(storageObj, key, equals = false, blacklist = true) {
    try {
        //Validate storage object
        if (!storageObj || typeof storageObj.removeItem !== 'function') {
            console.error("Invalid storage object passed to purgeTracker");
            return false;
        }

        //Finds trackers in storage
        let searchKeys = [];
        if (equals) {
            if (storageObj.getItem(key) !== null) searchKeys = [key]; //Only adds tracker if storage contains it
        } else {
            for (let i = 0; i < storageObj.length; i++) { //Searches all items in storage
                const k = storageObj.key(i);
                if (k && k.includes(key)) searchKeys.push(k); //Adds scanned object if it contains the key
            }
        }

        //Exits is no found trackers
        if (searchKeys.length < 1) {
            console.log(`No trackers found ${equals ? "matching" : "containing"} ${key}`);
            return false;
        }

        //Removes object from storage
        for (const k of searchKeys) {
            storageObj.removeItem(k); //RemoveItem is synchronous so no need to await it
        }
        //Fires event to add tracker to bin
        if (blacklist) {
            //PurgeTracker runs in MAIN world, whereas store needs to run in extension world to access extension storage
            //This passes it to comms.js which is in ISOLATED world
            window.dispatchEvent(
                new CustomEvent("DELETED_TRACKERS_TO_ISOLATED", {
                    detail: { keys: searchKeys }
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
 * //Scans a specific tracker to see if its present in recycling bin (HAS TO RUN IN MAIN WORLD)
 * @param {Object} storageObj - Imported local storage from site
 * @param {string} key - Tracker name to delete
 * @returns {Promise<Bool>}
 */
export async function scanTracker(storageObj, key) {
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

        switch (status) {
            case 0: //No match
                return false;
            case 1: //Match in recycling bin
                return purgeTracker(storageObj, key, true, false);
            case 2: //Match in blacklist
                return purgeTracker(storageObj, key, true, true); //Places tracker in bin
            default:
                console.error(`Incorrect status (${status}) return from ${key}`);
                return false;
        }
    } catch (err) {
        console.error(`Failed to scan tracker ${key}:`, err);
        return false;
    }
}