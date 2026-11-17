import {runBannerHandler} from "../banner/BannerHandler.js";

export async function getCurrentPage() {
    const tab = await getCurrentTab();
    if (tab === null) return null;
    const results = await chrome.scripting.executeScript({
        target: tab.id,
        func: () => {
            return {
                title: document.title,
                url: document.location.href,
                html:document.documentElement.outerHTML,
                headings: Array.from(document.querySelectorAll('h1')).map((el) => el.textContent),
            };
        },
    });
    const pageData = results[0]?.result;
    console.log("Page data from tab:", pageData);
    return pageData;
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id || !tab.url?.startsWith('http')) {
        console.warn("Unable to acquire current tab");
        return null;
    }
    return tab;
}

export async function runSelectorOnTab(selector) {
    const tab = await getCurrentTab();
    if (tab === null) return null;
    const [{result}] = await chrome.scripting.executeScript({
        target: tab.id,
        args: [selector],
        func: (sel) => {
            const el = document.querySelectorAll(sel);
            if (!el) return null;

            return {
                tagName: el.tagName,
                text: el.textContent?.trim() ?? '',
                html: el.innerHTML,
                value: el.value ?? null,
                href: el.getAttribute('href')
            };
        },
    });
    return result;
}

export async function insertAutoRejectScript() {
    const tab = await getCurrentTab();
    if (tab === null) return null;
    return await chrome.scripting.executeScript({
        target: {tabId: tab.id, allFrames: true},
        func: runBannerHandler
    });
}
