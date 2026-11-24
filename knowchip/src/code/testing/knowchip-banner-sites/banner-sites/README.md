# KnowChip — Consent Banner Test Sites

## Start

Requires Node.js **22+**. No `npm install`, OpenSSL, or third-party dependencies are required for HTTP.

```powershell
cd knowchip\src\code\testing\banner-sites
npm start
```

Open **http://127.0.0.1:8765/** in Chrome. The index links to all eight sites. The server binds to loopback only. Press `Ctrl+C` to stop.

Optional HTTPS mode reuses your **existing** KnowChip cookie lab certificate (`testing/.certs/localhost.pem` and `localhost-key.pem`). Run the original cookie lab once to create those, then start this lab with `npm run start:https` and open **https://127.0.0.1:8766/**. You may need to trust/accept its local self-signed certificate. HTTPS is optional for banner interaction tests; it is useful if your extension's permissions or tests expect secure origins.

## Levels

| Level | Website | Challenge | Expected extension outcome |
| --- | --- | --- | --- |
| 01 | Paperleaf | Prominent `Reject optional cookies` button | `reject` |
| 02 | Northstar | Both accept and reject buttons; accept is emphasised | `reject` |
| 03 | Form & Field | `Manage preferences` → turn off three toggles → save | `reject` |
| 04 | Minute Post | Small bottom-left notice, discreet `No, thanks` link | `reject` |
| 05 | Atelier Home | `Review my privacy` → expand three categories → disable toggles → save | `reject` |
| 06 | Circuit Daily | Consent shown after ~1.3 s → configure → switch off toggles → final confirmation | `reject` |
| 07 | The Ledger | **No free rejection**; accept or *simulate* payment | `accept` (per project's stated policy) |
| 08 | Maison Bleue | French-language controls → preferences → disable toggles → save | `reject` |


### Developer API (for manual verification, not for the extension to cheat)

- `GET /api/sites`: list of levels
- `GET /sites/<id>/api/state`: reads choice and optional cookies from the request
- `POST /sites/<id>/api/decision` JSON `{ "choice": "reject" | "accept" | "custom" | "paid", "optional": { ... } }`
- `POST /sites/<id>/api/reset` JSON `{}`

`paid` is accepted only for Level 07 and simply simulates checkout; **no real money or payment details are ever collected**. Conversely, a direct free `reject` or `custom` POST is intentionally refused for Level 07. All mutations require a same-origin request.

