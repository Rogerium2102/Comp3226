export function runBannerHandler() {

    function determineButtonToClick(buttonList) {
        const scoresForDetection = {
            'reject': 10,
            'cancel': 0,
            'pay' : -500,
            'accept': -10,
            'save preferences': 50,
            'options': 10,

        }
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

    function querySelectorAllDeep(selector, root = document) {
        const results = Array.from(root.querySelectorAll(selector));
        for (const element of root.querySelectorAll('*')) {
            if (element.shadowRoot) {
                results.push(...querySelectorAllDeep(selector, element.shadowRoot));
            }
        }
        return results;
    }

    const CONSENT_CONTEXT_REGEX = /\b(cookie|cookies|consent|gdpr|privacy|legitimate interest|vendors|partners|preferences)\b/i;

    function isInsideConsentContext(button) {
        if (window.self !== window.top && CONSENT_CONTEXT_REGEX.test(document.body?.innerText || '')) {
            return true;
        }

        let current = button.parentElement || button.getRootNode()?.host;
        let depth = 0;
        let maxDepth = 8;
        while (current && current !== document.body && depth < maxDepth) {
            const text = current.innerText || '';
            if (text.length > 20 && text.length < 12000 && CONSENT_CONTEXT_REGEX.test(text)) {
                return true;
            }
            current = current.parentNode || current.getRootNode()?.host;
            depth++;
        }
        return false;
    }
    async function handle() {
        console.log("Handle ran!")
        try {
            const allClickable = querySelectorAllDeep(
                'button, [role="button"], input[type="button"], input[type="submit"], a'
            ).filter(el => el.checkVisibility());
            console.log(`Clickable: `, allClickable);
            const allInEnvironment = allClickable.filter(el => isInsideConsentContext(el));
            console.log(`InEnvironment: `, allInEnvironment);
            if (!allClickable.length) return false;

            const {button, score} = determineButtonToClick(allClickable);
            if (!button || score <= 0) return false;

            console.log("Selected button!",button.textContent, "with score: ", score);
            button.click();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
    return handle();
}
