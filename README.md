# Botanical Story

A cozy, original nursery-management and botanical-garden game. This repository is the source of truth; the current milestone is browser-first and is not configured for production hosting or app-store submission.

## M0 playable loop

Start with 100 coins and three Daisy seeds. Plant in the 20 × 20 isometric nursery, wait for timestamp-based growth (the first Daisy takes 20 seconds), harvest, sell from the basket, and reinvest. Lavender, Tulips, Sunflowers, Roses, and Orchids unlock through progression. Decor is placeable and saved. Game values are provisional and versioned in packages/game-data. M0 visuals use Phaser-drawn terrain and pots plus temporary Unicode plant symbols; replace these with original licensed art before a polished release.

## Local development

Requirements: Node.js 20.19+ (or 22.12+) and PostgreSQL 14+.

1. Create a PostgreSQL database named botanical_story.
2. Copy .env.example to .env; set DATABASE_URL and a SESSION_SECRET of at least 32 characters. Never commit .env.
3. Install and migrate, then start both apps:

   npm install
   npm run db:migrate
   npm run dev

4. Open http://localhost:5173. The Vite server proxies /api to the Express API on port 3001.

Useful checks: npm test, npm run lint (TypeScript unused-code checks), npm run typecheck, and npm run build. To run the real API persistence test, set TEST_DATABASE_URL to a disposable PostgreSQL database and run npm test; it applies migrations and creates test players. Never use production data. Without this variable, the integration test is skipped.

For the isolated Playwright UI smoke test, install Chromium with npx playwright install chromium, then run npm run test:e2e. This browser test uses mocked API responses and does not prove database persistence; the separate API integration test covers that boundary.

For the full browser-to-PostgreSQL loop, configure DATABASE_URL and SESSION_SECRET for a disposable database, migrate it, then run E2E_LIVE_API=1 npm run test:e2e. It starts both apps, plants a Daisy, refreshes during growth, harvests, sells, and buys another seed.

## Repository layout

- apps/web — React/Vite interface and Phaser 3 isometric canvas.
- apps/server — Express API, guest sessions, PostgreSQL persistence, migrations.
- packages/game-core — framework-independent, deterministic game rules.
- packages/game-data — versioned plant definitions and provisional tuning.
- packages/shared — API contracts and input schemas.
- docs — architecture, decisions, deployment boundary, and known limitations.

## Static hosting boundary

GitHub Pages can serve the built browser assets only. It does not host the API or persist player data. To test from a static host, build with VITE_API_BASE_URL set to a separately hosted HTTPS API URL, set that API's CORS_ORIGINS to the exact site origin, and configure DATABASE_URL and SESSION_SECRET on the API host. No hosting provider is selected or configured in this repository. Do not deploy without owner approval.

## Mobile path

Touch input, safe-area spacing, viewport resizing, and server-backed guest identity are considered from the start. Native packaging is a later milestone; no native binaries, signing credentials, or store submission are part of M0. Capacitor can be evaluated when the browser loop and account recovery flow are stable. The native project should be opened on replit.com to create it; the iOS Replit app cannot create new native app projects.

## Security notes

- Currency and inventory mutations, harvesting, and sale rewards are validated on the server inside database transactions.
- Session tokens are signed with SESSION_SECRET; the browser stores only the bearer token, never a database credential.
- Harvest status updates are conditional and transactional. Sales accept an idempotency UUID, recorded uniquely per player in the ledger.
- This guest-session foundation is not account recovery or production anti-abuse hardening. Add account linking, rate limits, observability, and deployment-specific security review before public release.
