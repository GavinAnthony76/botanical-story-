# Decision 0001: browser-first game with portable simulation

- Status: accepted for M0
- Date: 2026-10-24

The playable client is React/Vite with Phaser 3. Server APIs use Express and PostgreSQL/Drizzle. Rules and versioned balance data live in renderer-independent TypeScript packages. This keeps the game usable in a browser and leaves Capacitor as a later packaging option without coupling simulation rules to a native runtime.

GitHub Pages, if used for testing, serves only static client files; persistent state requires an independently hosted HTTPS API and database. No production destination is selected. Do not deploy or submit to stores without owner approval.
