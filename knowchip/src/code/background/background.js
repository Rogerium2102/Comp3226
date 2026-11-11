import { checkBin } from "../deletion/recyclingBin.js";
import {attemptAutoReject, getBanner} from "../banner/BannerHandler.js";

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