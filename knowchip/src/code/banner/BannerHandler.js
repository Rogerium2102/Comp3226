const bannerProfiles = [
    '#onetrust-consent-sdk',
    '#CybotCookiebotDialog',
    '#cc-main',
    '.cookie-banner',
    '[aria-label*="cookie" i]',
    '[id*="cookie" i]',
    '[class*="cookie" i]'
].join(', ')

/**
 * Gets the cookie banner on a page, null is none is detected
 * @return {Element}
 */
export function getBanner() {
    return document.querySelector(bannerProfiles);
}

const wait = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

/**
 *
 * @param {Element} banner
 * @param {number} maxAttempts
 * @return {boolean}
 */
export async function attemptAutoReject(banner, maxAttempts) {
    let attempts = 0;
    while (getBanner() !== null && attempts < maxAttempts) {
        const buttonsWithin = Array.from(banner.querySelectorAll('button'));
        if (buttonsWithin.length) {
            const {button, score} = determineButtonToClick(buttonsWithin);
            console.log(`Selected button: ${button.id} with score: ${score}`);
            button.click();
            await wait(3);
            attempts += 1;
        }
        else {
            break;
        }
    }
    return getBanner() === null;
}

const scoresForDetection = {
    'reject': 10,
    'cancel': 0,
    'pay' : -500,
    'accept': -10,
    'save preferences': 50,
    'options': 10,

}

/**
 *
 * @param {Array<HTMLButtonElement>}buttonList
 * @return {{button: HTMLButtonElement, score: number}}
 */
function determineButtonToClick(buttonList) {
    const scores = {}
    let buttonScore = 0;
    buttonList.forEach(button => {
        if (button.checkVisibility()) {
            const text = button.textContent;
            for (const [key, value] of Object.entries(scoresForDetection)) {
                if (text.toLowerCase().includes(key)) {
                    buttonScore += value;
                }
            }
            scores[button.id] = buttonScore;
        }
    });
    let maxScore = -Infinity;
    let maxId= "";
    for (const [key, value] of Object.entries(scores)) {
        if (value > maxScore) {
            maxScore = value;
            maxId = key;
        }
    }
    if (maxId.length > 0) {
        const button = buttonList.find(button => button.id === maxId);
        return {
            button: button,
            score: maxScore
        }
    }
    return {
        button: null,
        score: -1
    }
}
