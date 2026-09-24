# The Coffee Deck

A spaced-repetition flashcard app for coffee professionals — baristas, roasters, trainers, green buyers and café owners.

- 400 cards across 28 categories, each with a definition, why it matters, a pro tip, a common mistake and a challenge question
- Six languages: English, Spanish, Portuguese, German, French, Italian
- Study mode with Again / Hard / Good / Easy spaced repetition, progress stats and streaks
- Interactive recipe cards with a live ratio calculator
- Installable as an app (PWA) and works offline
- Free sample tier plus Coffee Deck Pro subscription (Stripe)

Live at thecoffeedeck.net. Built by First Draft Coffee.

## How it's put together

- `content/<CATEGORY>.json` — the card content. **This is the only place cards are edited.**
- `scripts/buildCards.js` — compiles the content into:
  - `public/data/deck/free-<lang>.json` — the free sample cards only (public)
  - `worker/deck.js` — the full deck, bundled into the Cloudflare Worker and served only to verified subscribers through `/api/deck`
  
  It also checks for duplicate card numbers, duplicate titles and broken links, and makes related-card links two-way.
- `src/` — the app (vanilla JavaScript, built with Vite)
- `worker/index.js` — the Cloudflare Worker: Stripe checkout, subscription checks, signed access passes, email sign-in links and the subscriber deck
- `public/images/cards/<number>.jpg` — card photos (real photography only, 600×900 portrait target, progressive JPEG quality 80)

Paid card content must never be placed under `public/` — everything there can be downloaded by anyone.

## Subscriber access

- Buying through Stripe unlocks the device straight away and saves a signed access pass.
- On another device, "Restore access" emails a sign-in link (valid 20 minutes). The reply is the same whether or not the email subscribes.
- The app re-checks the subscription daily using the saved pass.
- Email sending needs the Worker secret `RESEND_API_KEY` (exact name) and `thecoffeedeck.net` verified in Resend. Without the key, restore falls back to unlocking by email alone.
- Browsers saved before access passes existed can upgrade from their saved email until 8 October 2026.

## Working on it

```
npm install
npm run build
node smoke-test.mjs
node smoke-test-search.mjs
node smoke-test-worker.mjs
```

Pushing to the `rebuild-v1` branch deploys automatically through Cloudflare.
