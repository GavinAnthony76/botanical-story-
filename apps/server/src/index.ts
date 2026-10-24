import "dotenv/config";
import express from "express";
import cors from "cors";
import { and, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buySeedSchema, decorationSchema, plantIdSchema, plantSeedSchema, sellSchema, type SpeciesId } from "@botanical-story/shared";
import { canPlaceAt, canUnlock, saleValue, xpForSale } from "@botanical-story/game-core";
import { getSpecies, SPECIES } from "@botanical-story/game-data";
import { db, pool } from "./db";
import { decorations, inventory, ledger, planted, players } from "./schema";
import { issueToken, requireSession, type AuthRequest } from "./auth";
const app = express(); app.disable("x-powered-by");
const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin) ? origin || false : false), methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "32kb" }));
const port = Number(process.env.API_PORT ?? 3001);
const route = (fn: (req: AuthRequest, res: express.Response) => Promise<void>) => (req: AuthRequest, res: express.Response, next: express.NextFunction) => { void fn(req, res).catch(next); };
const fail = (res: express.Response, message: string, code: string, status = 400) => res.status(status).json({ error: message, code });
const parse = <T>(schema: z.ZodType<T>, value: unknown): T | null => { const result = schema.safeParse(value); return result.success ? result.data : null; };
const addExpr = (column: string, amount: number) => sql.raw(column + " + " + Math.trunc(amount));
const subExpr = (column: string, amount: number) => sql.raw(column + " - " + Math.trunc(amount));
const xpLevelExpr = (amount: number) => sql.raw("floor((xp + " + Math.trunc(amount) + ") / 100) + 1");
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/species", (_req, res) => res.json({ version: 1, species: SPECIES }));
app.post("/api/session/guest", route(async (_req, res) => {
  const playerId = randomUUID(); const token = issueToken(playerId);
  await db.transaction(async (tx) => { await tx.insert(players).values({ id: playerId, coins: 100, xp: 0, level: 1 }); await tx.insert(inventory).values({ playerId, speciesId: "daisy", seeds: 3, plants: 0 }); await tx.insert(ledger).values({ playerId, delta: 100, reason: "guest_welcome" }); });
  res.status(201).json({ playerId, token });
}));
app.use("/api", requireSession);
app.get("/api/state", route(async (req, res) => {
  const playerId = req.playerId!;
  const [playerRows, itemRows, plantRows, decorationRows] = await Promise.all([db.select().from(players).where(eq(players.id, playerId)).limit(1), db.select().from(inventory).where(eq(inventory.playerId, playerId)), db.select().from(planted).where(eq(planted.playerId, playerId)), db.select().from(decorations).where(eq(decorations.playerId, playerId))]);
  const player = playerRows[0]; if (!player) { fail(res, "Player not found.", "PLAYER_NOT_FOUND", 404); return; }
  const known = new Map(itemRows.map((row) => [row.speciesId, row]));
  res.json({ playerId, coins: player.coins, xp: player.xp, level: player.level, tutorialComplete: player.tutorialComplete,
    inventory: SPECIES.map((species) => ({ speciesId: species.id, seeds: known.get(species.id)?.seeds ?? 0, plants: known.get(species.id)?.plants ?? 0 })),
    plants: plantRows.map((plant) => ({ id: plant.id, speciesId: plant.speciesId, x: plant.x, y: plant.y, plantedAt: plant.plantedAt.toISOString(), harvestAt: plant.harvestAt.toISOString(), status: plant.status })),
    decorations: decorationRows.map(({ id, kind, x, y }) => ({ id, kind, x, y })) });
}));
app.post("/api/seeds/buy", route(async (req, res) => {
  const body = parse(buySeedSchema, req.body); if (!body) { fail(res, "Choose a valid seed and quantity.", "INVALID_INPUT"); return; }
  const playerId = req.playerId!; const species = getSpecies(body.speciesId); const cost = species.seedPrice * body.quantity;
  try { await db.transaction(async (tx) => {
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1).for("update"); if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (!canUnlock(body.speciesId, player.level)) throw new Error("LEVEL_LOCKED");
    const updated = await tx.update(players).set({ coins: subExpr("coins", cost) }).where(and(eq(players.id, playerId), gte(players.coins, cost))).returning({ id: players.id });
    if (!updated.length) throw new Error("NOT_ENOUGH_COINS");
    await tx.insert(inventory).values({ playerId, speciesId: body.speciesId, seeds: body.quantity }).onConflictDoUpdate({ target: [inventory.playerId, inventory.speciesId], set: { seeds: addExpr("seeds", body.quantity) } });
    await tx.insert(ledger).values({ playerId, delta: -cost, reason: "seed_purchase" });
  }); res.json({ ok: true }); }
  catch (error) { const code = error instanceof Error ? error.message : "PURCHASE_FAILED"; fail(res, code === "NOT_ENOUGH_COINS" ? "Not enough coins." : code === "LEVEL_LOCKED" ? "That seed unlocks at a later level." : "Unable to buy those seeds.", code); }
}));
app.post("/api/plants", route(async (req, res) => {
  const body = parse(plantSeedSchema, req.body); if (!body) { fail(res, "Choose a valid tile and seed.", "INVALID_INPUT"); return; }
  const playerId = req.playerId!; const species = getSpecies(body.speciesId); const now = new Date();
  try { const plant = await db.transaction(async (tx) => {
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1).for("update"); if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (!canUnlock(body.speciesId, player.level)) throw new Error("LEVEL_LOCKED");
    const [seedRows, plantRows, decorationRows] = await Promise.all([tx.select().from(inventory).where(and(eq(inventory.playerId, playerId), eq(inventory.speciesId, body.speciesId))).limit(1), tx.select({ x: planted.x, y: planted.y }).from(planted).where(and(eq(planted.playerId, playerId), eq(planted.status, "growing"))), tx.select({ x: decorations.x, y: decorations.y }).from(decorations).where(eq(decorations.playerId, playerId))]);
    if (!(seedRows[0]?.seeds)) throw new Error("NO_SEEDS");
    if (!canPlaceAt(body.x, body.y, [...plantRows, ...decorationRows])) throw new Error("TILE_OCCUPIED");
    const consumed = await tx.update(inventory).set({ seeds: subExpr("seeds", 1) }).where(and(eq(inventory.playerId, playerId), eq(inventory.speciesId, body.speciesId), gte(inventory.seeds, 1))).returning({ speciesId: inventory.speciesId });
    if (!consumed.length) throw new Error("NO_SEEDS");
    const harvestAt = new Date(now.getTime() + species.growthMs);
    const [created] = await tx.insert(planted).values({ playerId, speciesId: body.speciesId, x: body.x, y: body.y, plantedAt: now, harvestAt }).returning(); return created;
  }); res.status(201).json({ id: plant.id, speciesId: plant.speciesId, x: plant.x, y: plant.y, plantedAt: plant.plantedAt.toISOString(), harvestAt: plant.harvestAt.toISOString(), status: plant.status }); }
  catch (error) { const code = error instanceof Error ? error.message : "PLANT_FAILED"; fail(res, code === "NO_SEEDS" ? "You need a seed of that kind first." : code === "TILE_OCCUPIED" ? "That spot is already in use." : code === "LEVEL_LOCKED" ? "That seed unlocks at a later level." : "Unable to plant there.", code, code === "TILE_OCCUPIED" ? 409 : 400); }
}));
app.post("/api/plants/harvest", route(async (req, res) => {
  const body = parse(plantIdSchema, req.body); if (!body) { fail(res, "Choose a plant to harvest.", "INVALID_INPUT"); return; }
  const playerId = req.playerId!; const now = new Date();
  try { const result = await db.transaction(async (tx) => {
    const [plant] = await tx.select().from(planted).where(and(eq(planted.id, body.plantId), eq(planted.playerId, playerId))).limit(1);
    if (!plant) throw new Error("PLANT_NOT_FOUND"); if (plant.status !== "growing") throw new Error("ALREADY_HARVESTED"); if (plant.harvestAt.getTime() > now.getTime()) throw new Error("NOT_READY");
    const changed = await tx.update(planted).set({ status: "harvested", harvestedAt: now }).where(and(eq(planted.id, body.plantId), eq(planted.playerId, playerId), eq(planted.status, "growing"))).returning({ id: planted.id, speciesId: planted.speciesId });
    if (!changed.length) throw new Error("ALREADY_HARVESTED"); const item = changed[0];
    await tx.insert(inventory).values({ playerId, speciesId: item.speciesId, seeds: 0, plants: 1 }).onConflictDoUpdate({ target: [inventory.playerId, inventory.speciesId], set: { plants: addExpr("plants", 1) } });
    const xp = getSpecies(item.speciesId as SpeciesId).xpReward; await tx.update(players).set({ xp: addExpr("xp", xp), level: xpLevelExpr(xp) }).where(eq(players.id, playerId));
    return { speciesId: item.speciesId, xp };
  }); res.json({ ok: true, ...result }); }
  catch (error) { const code = error instanceof Error ? error.message : "HARVEST_FAILED"; const message = code === "NOT_READY" ? "That plant is still growing." : code === "ALREADY_HARVESTED" ? "This plant has already been harvested." : "Unable to harvest that plant."; fail(res, message, code, code === "PLANT_NOT_FOUND" ? 404 : 409); }
}));
app.post("/api/plants/sell", route(async (req, res) => {
  const body = parse(sellSchema, req.body); if (!body) { fail(res, "Choose a valid plant quantity and request id.", "INVALID_INPUT"); return; }
  const playerId = req.playerId!; const coins = saleValue(body.speciesId, body.quantity); const xp = xpForSale(body.speciesId, body.quantity);
  try { const result = await db.transaction(async (tx) => {
    const [prior] = await tx.select().from(ledger).where(and(eq(ledger.playerId, playerId), eq(ledger.idempotencyKey, body.idempotencyKey), eq(ledger.reason, "plant_sale"))).limit(1);
    if (prior) return { coins: prior.delta, xp: prior.xpDelta };
    const removed = await tx.update(inventory).set({ plants: subExpr("plants", body.quantity) }).where(and(eq(inventory.playerId, playerId), eq(inventory.speciesId, body.speciesId), gte(inventory.plants, body.quantity))).returning({ speciesId: inventory.speciesId });
    if (!removed.length) throw new Error("NOT_ENOUGH_PLANTS");
    await tx.update(players).set({ coins: addExpr("coins", coins), xp: addExpr("xp", xp), level: xpLevelExpr(xp) }).where(eq(players.id, playerId));
    await tx.insert(ledger).values({ playerId, delta: coins, xpDelta: xp, reason: "plant_sale", idempotencyKey: body.idempotencyKey }); return { coins, xp };
  }); res.json({ ok: true, ...result }); }
  catch { fail(res, "You do not have enough harvested plants to sell, or the request could not be completed.", "SALE_FAILED", 409); }
}));
app.post("/api/decorations", route(async (req, res) => {
  const body = parse(decorationSchema, req.body); if (!body) { fail(res, "Choose a valid decoration and tile.", "INVALID_INPUT"); return; }
  const playerId = req.playerId!;
  try {
    const placed = await db.transaction(async (tx) => {
      const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).limit(1).for("update");
      if (!player) throw new Error("PLAYER_NOT_FOUND");
      const [plantRows, decorationRows] = await Promise.all([tx.select({ x: planted.x, y: planted.y }).from(planted).where(and(eq(planted.playerId, playerId), eq(planted.status, "growing"))), tx.select({ x: decorations.x, y: decorations.y }).from(decorations).where(eq(decorations.playerId, playerId))]);
      if (!canPlaceAt(body.x, body.y, [...plantRows, ...decorationRows])) throw new Error("TILE_OCCUPIED");
      const [created] = await tx.insert(decorations).values({ playerId, ...body }).returning(); return created;
    });
    res.status(201).json({ id: placed.id, kind: placed.kind, x: placed.x, y: placed.y });
  } catch { fail(res, "That decoration could not be placed there.", "TILE_OCCUPIED", 409); }
}));
app.post("/api/tutorial/complete", route(async (req, res) => { await db.update(players).set({ tutorialComplete: true }).where(eq(players.id, req.playerId!)); res.json({ ok: true }); }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error("API request failed", error instanceof Error ? error.message : "unknown error"); res.status(500).json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }); });
app.listen(port, () => console.log("Botanical Story API listening on " + port));
process.on("SIGTERM", () => { void pool.end(); });
