import { deleteCookie } from "./deletion/deleter.js";
import { checkBin } from "./deletion/recyclingBin.js";

console.log("Cookie rejected\nEverything's fine. Don't worry.");

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