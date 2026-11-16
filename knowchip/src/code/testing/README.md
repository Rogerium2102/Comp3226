Testing

For testing, you need to have Node.js installed (version 22+) and ensure OpenSSL exists and is identifiable (through your PATH etc). 

##################################################
Running the Site

In order to run the site, navigate to the root 'testing' folder in CMD and run 'npm start'. Then, on your browser, open 2 tabs, one 'https://localhost:8443/' and the other 'https://127.0.0.1:8443/'. You must be running both sites using the previous comand first.
Go through the 'this connection is not secure' warning if it pops up.
Youll see 2 sites, the publisher (that acts as the first party website the user visits), and the external testing site or 'tracker' (that acts as a third party website that will eventually attach cookies to the same browser, loaded via the publisher site). You can actually open the external testing site, ie: the third party service that attempts to attach cookies to the browser.

Have our extension running and play around with a few of the buttons, noting what the extension does.


##################################################
Automated test suites

The 'automated' test section includes automated tests that do not require the test suite to be running. There are multiple tests here:

'npm test' - runs basic tests covering cookie definitions, server endpoints and the mocked extension functions
'npm run test:browser' - auto opens a testing suite and performs several tests

In order to run the second one, you need to install chromium playwright using these commands:

'npm ci'
'npx playwright install chromium'




