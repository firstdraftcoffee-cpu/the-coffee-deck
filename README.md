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
- `worker/index.js` — the Cloudflare Worker: Stripe checkout, subscription checks, signed access passes and the subscriber deck
- `public/images/cards/<number>.jpg` — card photos (real photography only, 600×900 portrait target, progressive JPEG quality 80)

Paid card content must never be placed under `public/` — everything there can be downloaded by anyone.

## Working on it

```
npm install
npm run build
node smoke-test.mjs
node smoke-test-search.mjs
node smoke-test-worker.mjs
```

Pushing to the `rebuild-v1` branch deploys automatically through Cloudflare.
