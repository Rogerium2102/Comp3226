import {getAllCookies} from "./CookieHandler.js";

document.getElementById('clickBtn').addEventListener('click', async () => {
    alert('Dumping cookies to console');
    const cookies = await getAllCookies();
    cookies.forEach((cookie) => {
        console.log(cookie.domain);
    });
});

