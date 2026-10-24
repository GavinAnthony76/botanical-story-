import { afterAll, beforeAll, expect, test } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

// Opt in with a disposable database, never a production database.
const enabled = Boolean(process.env.TEST_DATABASE_URL);
const base = "http://127.0.0.1:3017/api";
let server: ChildProcess | undefined;
beforeAll(async () => {
  if (!enabled) return;
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL!, SESSION_SECRET: randomBytes(48).toString("hex"), API_PORT: "3017" };
  const migrated = spawnSync(process.execPath, ["--import", "tsx", "apps/server/src/migrate.ts"], { env, encoding: "utf8" });
  if (migrated.status !== 0) throw new Error("Test database migration failed.");
  server = spawn(process.execPath, ["--import", "tsx", "apps/server/src/index.ts"], { env, stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + "/health")).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test API did not start.");
}, 20_000);
afterAll(() => { server?.kill("SIGKILL"); });

test.skipIf(!enabled)("PostgreSQL preserves the guest loop and prevents duplicate rewards", async () => {
  const guest = await (await fetch(base + "/session/guest", { method: "POST" })).json();
  const headers = { Authorization: "Bearer " + guest.token, "Content-Type": "application/json" };
  const state = async () => (await fetch(base + "/state", { headers })).json();
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  expect((await fetch(base + "/state")).status).toBe(401);
  expect((await state()).coins).toBe(100);
  const planted = await post("/plants", { speciesId: "daisy", x: 10, y: 10 });
  expect(planted.status).toBe(201);
  const plant = await planted.json();
  expect((await post("/plants/harvest", { plantId: plant.id })).status).toBe(409);
  expect((await post("/plants", { speciesId: "daisy", x: 10, y: 10 })).status).toBe(409);
  expect((await state()).inventory.find((item: { speciesId: string }) => item.speciesId === "daisy").seeds).toBe(2);
  expect((await state()).plants[0].harvestAt).toBe(plant.harvestAt);
  expect((await post("/decorations", { kind: "bench", x: 3, y: 4 })).status).toBe(201);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Date.parse(plant.harvestAt) - Date.now()) + 100));
  const harvests = await Promise.all([post("/plants/harvest", { plantId: plant.id }), post("/plants/harvest", { plantId: plant.id })]);
  const harvestBodies = await Promise.all(harvests.map((response) => response.json()));
  expect(harvests.map((response) => response.status).sort(), JSON.stringify(harvestBodies)).toEqual([200, 409]);
  const sale = { speciesId: "daisy", quantity: 1, idempotencyKey: randomUUID() };
  expect((await post("/plants/sell", sale)).status).toBe(200);
  expect((await post("/plants/sell", sale)).status).toBe(200);
  const saved = await state();
  expect(saved.coins).toBe(112);
  expect(saved.inventory.find((item: { speciesId: string }) => item.speciesId === "daisy").plants).toBe(0);
  expect(saved.decorations[0]).toMatchObject({ kind: "bench", x: 3, y: 4 });
  expect((await post("/seeds/buy", { speciesId: "daisy", quantity: 1 })).status).toBe(200);
  expect((await state()).coins).toBeLessThan(saved.coins);
}, 40_000);
