import {insertAutoRejectScript, insertFileInCurrentTab} from "./tabWorker.js"
import { store, checkBin, checkBlacklist } from "../deletion/recyclingBin.js";

console.log("Cookie rejected\nEverything's fine. Don't worry.");

/*
//Listens whenever cookies are added, edited or deleted.
chrome.cookies.onChanged.addListener(async (info) => {
    const {cookie, cause, deleted} = info; //Unpacks info
    if (deleted) {
        console.log(`Cookie deleted: ${cookie.name}, Cause: ${cause}`);
    } else {
        //Checks if cookie is a restored cookie from the bin and deletes it if so
        await checkBin(cookie).then((exists) => {
            if (exists) deleteCookie(cookie);
        });
    }
});
*/

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
/**
 * RUNS CODE WHEN THE PAGE UPDATES
 */
chrome.tabs.onUpdated.addListener( async (id, changeInfo, tab) => {
    insertFileInCurrentTab(false, ["injected.js"]);
    await delay(3000); //Wait 3 seconds to ensure the page has updated
    insertAutoRejectScript().then(result => {
        if (result === null) {
            console.log("Result was null!");
        } else {
            const success = result.some((frame) => Boolean(frame?.result));
            const output = success ? "Rejected" : "Failed";
            console.log("AutoReject ended in state: ", output);
        }
    });
})

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