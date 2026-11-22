import {attemptAutoReject, getBanner} from "../banner/BannerHandler.js";
import {getCurrentPage, runSelectorOnTab} from "./tabWorker.js"
import { store, checkBin, checkBlacklist } from "../deletion/recyclingBin.js";

console.log("Cookie rejected\nEverything's fine. Don't worry.");

const bannerDetectTimer = setInterval(() => {
    const banner = getBanner();
    const bannerRemovalMaxAttempts = 3;
    if (banner) {
        console.log("Cookie banner detected...");
        if (attemptAutoReject(banner, bannerRemovalMaxAttempts)) {
            console.log("Cookie banner removed successfully!");
        }
        else {
            console.warn("Failed to remove cookie banner");
        }
    }
}, 10000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "DELETED_TRACKERS_TO_EXTENSION": //Receives deleted trackers from ISOLATED world (comms.js) and stores them in the recycling bin
            (async () => {
                let failCount = 0;
                for (const key of message.keys) {
                    if ((await store(key)) < 0) failCount++;
                }
                if (failCount > 0) console.error(`Storing trackers failed ${failCount} times`);

                sendResponse({success: failCount === 0, failCount}); //Right now this isn't read
            })();
            return true; //Keeps channel open for sendResponse

        case "CHECK_TRACKER_TO_EXTENSION": //Receives tracker from ISOLATED world and checks if it is in bin or blacklist
            (async () => {
                if ((await checkBin(message.key)).match) { //Checks if match is found in bin
                    sendResponse({status: 1});
                    return;
                }
                if (await checkBlacklist(message.key)) { //Checks if match is found in blacklist
                    sendResponse({status: 2});
                    return;
                }
                sendResponse({status: 0}); //No match found
            })();
            return true;

        default:
            break;
    }
});