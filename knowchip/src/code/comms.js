/* THIS IS NOW DEPRECIATED */

/* Designed to be injected into the script's ISOLATED world to communicate between injected.js and browser storage */

//Fired by purgeTracker from storageDeleter.js, passes deleted tracker key to extension world
//Passes it to background.js
window.addEventListener("DELETED_TRACKERS_TO_ISOLATED", async (event) => {
    const deletedTrackerKeys = event.detail.keys;
    chrome.runtime.sendMessage({
        type: "DELETED_TRACKERS_TO_EXTENSION",
        keys: deletedTrackerKeys
    });
});

//Fired by scanTracker from storageDeleter.js
//Passes it to background.js for response
//Sends response back to INJECTED world
window.addEventListener("CHECK_TRACKER_TO_ISOLATED", async (event) => {
    const trackerKey = event.detail.key;
    const response = await chrome.runtime.sendMessage({
        type: "CHECK_TRACKER_TO_EXTENSION",
        key: trackerKey
    });

    window.dispatchEvent(
        new CustomEvent("BLACKLIST_STATUS_TO_MAIN", {
            detail: {
                key: trackerKey, //Used by scanTracker to verify same response
                status: response?.status ?? -1 //Attempts check status of response, if not available then an error val is sent
            }
        })
    );
});