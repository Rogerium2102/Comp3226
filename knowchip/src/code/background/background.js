import {insertAutoRejectScript, insertFileInCurrentTab, insertCommsScript} from "./tabWorker.js"
import { store, checkBin, checkBlacklist, enterBlacklist } from "../deletion/recyclingBin.js";
import { rateLimiter, rateLimiterMaster } from "../deletion/deleterInExtWrld.js";

console.log("Cookie rejected\nEverything's fine. Don't worry.");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function UpdateBannerTotal(reset) {
    let currentTotal = -1;
    if (!reset) {
        currentTotal = await chrome.storage.local.get("BannerTotal");
    }
    chrome.storage.local.set({
        "BannerTotal": currentTotal + 1,
    })
}
/**
 * RUNS CODE WHEN THE PAGE UPDATES
 */
chrome.tabs.onUpdated.addListener( async (id, changeInfo, tab) => {
    await insertCommsScript(); //Inserts intermediatory script for communication between MAIN (injected.js) and extension (background.js)
    
    insertFileInCurrentTab(false, ["injected.js"], "MAIN");
    await delay(3000); //Wait 3 seconds to ensure the page has updated
    insertAutoRejectScript().then(result => {
        if (result === null) {
            console.log("Result was null!");
        } else {
            const success = result.some((frame) => Boolean(frame?.result));
            const output = success ? "Rejected" : "Failed";
            console.log("AutoReject ended in state: ", output);
            if (success) {
                UpdateBannerTotal(false);
            }
        }
    });
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "REQUEST_DELETION_APPROVAL": //Calls the rate limiter to ensure no deletion overload
            const passed = rateLimiter(message.key);
            sendResponse({success: passed});
            break; //No need to return to keep channel open: reply send synchronously

        case "DELETED_TRACKERS_TO_EXTENSION": //Receives deleted trackers from ISOLATED world (comms.js) and stores them in the recycling bin
            (async () => {
                let failCount = 0;
                for (const t of message.trackers) {
                    if ((await store(t)) < 0) failCount++;
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
        
        case "BLACKLIST_TRACKER_TO_EXTENSION":
            enterBlacklist(message.key, false);
            break;
        default:
            break;
    }
});


rateLimiterMaster(); //Starts rate limiter