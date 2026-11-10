import {getAllCookies} from "./Storage/CookieHandler.js";

export async function dumpCookies(){
    alert('Dumping cookies to console');
    const cookies = await getAllCookies();
    cookies.forEach((cookie) => {
        console.log(cookie.domain);
    });
}

