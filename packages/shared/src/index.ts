import { z } from "zod";
export const speciesIdSchema = z.enum(["daisy", "lavender", "tulip", "sunflower", "rose", "orchid"]);
export type SpeciesId = z.infer<typeof speciesIdSchema>;
export const tileSchema = z.object({ x: z.number().int().min(0).max(19), y: z.number().int().min(0).max(19) });
export type Tile = z.infer<typeof tileSchema>;
export const buySeedSchema = z.object({ speciesId: speciesIdSchema, quantity: z.number().int().min(1).max(20) });
export const plantSeedSchema = z.object({ speciesId: speciesIdSchema, x: z.number().int().min(0).max(19), y: z.number().int().min(0).max(19) });
export const plantIdSchema = z.object({ plantId: z.string().uuid() });
export const sellSchema = z.object({ speciesId: speciesIdSchema, quantity: z.number().int().min(1).max(100), idempotencyKey: z.string().uuid() });
export const decorationSchema = z.object({ kind: z.enum(["birdbath", "bench", "planter"]), x: z.number().int().min(0).max(19), y: z.number().int().min(0).max(19) });
export interface PlantState { id: string; speciesId: SpeciesId; x: number; y: number; plantedAt: string; harvestAt: string; status: "growing" | "harvested" }
export interface DecorationState { id: string; kind: "birdbath" | "bench" | "planter"; x: number; y: number }
export interface InventoryState { speciesId: SpeciesId; seeds: number; plants: number }
export interface PlayerState { playerId: string; coins: number; xp: number; level: number; tutorialComplete: boolean; inventory: InventoryState[]; plants: PlantState[]; decorations: DecorationState[] }
export interface SessionResponse { token: string; playerId: string }
