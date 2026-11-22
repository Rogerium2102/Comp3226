import {insertAutoRejectScript, insertFileInCurrentTab} from "./tabWorker.js"

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
    insertFileInCurrentTab(false, ["injected.js"], "MAIN");
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
