# Botanical Story architecture

## Current boundary

M0 is a browser game backed by a separately runnable Express API and PostgreSQL. GitHub is the source of truth. The repo does not choose or configure a production host. The browser can be hosted as static assets (including a future GitHub Pages test); static hosting never owns player saves or currency.

## Monorepo

- apps/web: React/Vite overlays and Phaser 3 scene. Phaser renders the 20×20 isometric nursery; UI and game state stay outside the scene. The scene receives data and sends tile intents back to React.
- apps/server: Express endpoints, signed guest sessions, validation, and Drizzle/PostgreSQL access.
- packages/game-core: pure timestamp growth, sale/XP math, unlock checks, and tile occupancy helpers. No framework or renderer imports.
- packages/game-data: versioned species configuration; values are provisional.
- packages/shared: Zod request schemas and shared state contracts.

## State and trust

The API owns player identity, wallet, XP/level, seed and flower inventory, planted timestamps, decorations, tutorial completion, and ledger entries. A signed 30-day guest bearer token identifies a player; identity survives refreshes while the browser retains that token. Plants become harvestable only when the server's harvest_at has passed. Harvest changes the plant row conditionally and grants inventory/XP in one transaction. Sales atomically remove inventory, update coins/XP, and add a wallet ledger entry with a unique idempotency key. The client animates progress but cannot grant rewards.

apps/server/migrations/0001_initial.sql is tracked schema history. Apply via npm run db:migrate; add future migrations with new numbered SQL files and update the migration runner before shipping them.

## Input and visual interaction

The scene uses a consistent diamond tile grid with pointer drag, wheel zoom, and two-pointer pinch zoom. React controls the selected seed, decor mode, shop, inventory, and onboarding. Mobile layout uses safe-area insets and collapses the garden controls into a compact panel.

## Later decisions, not M0

Account linking and recovery, server rate limits, production hosting, offline mutation queue, asset pipeline, environmental attributes, breeding, multiplayer, paid currency, native packaging, signing, and store release are outside this milestone. Capacitor remains a candidate because the browser client already uses responsive web input; native-specific requirements should be assessed before packaging.


## M0 art note

Terrain and pots are drawn with Phaser primitives. Unicode plant symbols are temporary placeholders, not final authored assets; an original, consistently sized growth-stage sprite set is a recommended next step.
