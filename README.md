# QR לעתיד · Future QR

כל ילד מקבל קוד QR אישי לכל החיים. משפחה וחברים סורקים, נותנים מתנת יום הולדת, והכסף מושקע בחשבון על שם הילד אצל בית השקעות מפוקח עד גיל 21.

Every child gets a lifelong QR code. Family and friends scan it and give birthday money, which is invested in an account in the child's name at a regulated investment house until age 21.

## What's in the app

| Layer | Features |
|---|---|
| Gift experience | Public gift page per child (`/g/:code`), suggested amounts (₪52 / ₪100 / ₪180 / ₪360), "what this becomes at 21", greeting wall, **time-capsule greetings** sealed until a chosen age, events/campaigns (birthday, bar/bat mitzvah) with goals and countdown, hosted checkout (card / Bit / Apple Pay / Google Pay), receipt + thank-you page, printable / downloadable QR card, WhatsApp share |
| Tracking | Parent dashboard for all kids, value / deposits / gain, weekly growth chart, age-21 projection with cautious / expected / optimistic band, goal progress, holdings, transaction statement, track switching |
| Financial education | 12 bilingual lessons across 4 age bands (4–7, 8–12, 13–17, 18–21), quizzes graded server-side, stars, **Kid mode** with a money tree that grows with the portfolio |
| Technology layer | Guardian KYC (Israeli ID check-digit), partner account per child, adapter interfaces for the investment partner, payments and notifications, admin console (AUM, gift volume, monthly chart, users, outbox, audit log) |

Hebrew RTL first, full English translation, switchable at runtime (`web/src/i18n`). Installable PWA (manifest + service worker). Light and dark mode.

## What is mocked

The app is **not** the regulated manager; money is held by the partner. No real partner or payment API exists yet, so these run as sandboxes behind adapter interfaces:

- `server/src/adapters/investment-partner.js` – `SandboxInvestmentPartner`: 4 tracks with deterministic simulated daily prices since 2004; buy/sell orders at NAV.
- `server/src/adapters/payments.js` – `SandboxPayments`: in-app hosted checkout at `/pay/:id`, no money moves.
- `server/src/adapters/notifier.js` – `OutboxNotifier`: emails are stored and shown in the admin console instead of sent.
- KYC approves any valid Israeli ID instantly (production: partner onboarding with ID scan, liveness and AML screening).

To go live, implement the same interface for the real partner / processor and pass it to `createApp` in `server/src/index.js`.

## Stack

- **server/** Node 22, Express, built-in `node:sqlite`, HMAC-signed tokens, scrypt passwords. Amounts stored in agorot.
- **web/** React 18 + TypeScript + Vite, React Router, `qrcode`. Charts are hand-written SVG.

## Run

```bash
npm install
npm run seed      # demo data
npm run build     # build the web app
npm start         # http://localhost:3000 serves API + app
npm test          # API tests
```

Dev mode with hot reload: `npm run dev` (web on :5173 proxies `/api` to :3000).

Demo accounts: parent `demo@kfq.app` / `demo1234`, admin `admin@kfq.app` / `admin1234`.
Demo gift pages: `/g/itay2013demo` (bar mitzvah campaign), `/g/noa2019demo`.
Sandbox KYC ID: `000000018`.

Env: `PORT`, `DB_PATH`, `AUTH_SECRET` (set this in production; otherwise tokens reset on restart).

## Limits and rules in code

- Gift min ₪18, max ₪5,000 per gift without extra giver verification (`server/src/lib/portfolio.js`).
- Codes can be opened for children under 18; payout age 21.
- Public gift page never shows balances or the child's surname.
