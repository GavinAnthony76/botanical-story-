import type { SpeciesId } from "@botanical-story/shared";
import { getSpecies } from "@botanical-story/game-data";
export interface GrowthState { stage: 0 | 1 | 2 | 3; ready: boolean; progress: number }
export function growthState(plantedAtMs: number, harvestAtMs: number, nowMs: number): GrowthState {
  const duration = Math.max(1, harvestAtMs - plantedAtMs);
  const progress = Math.max(0, Math.min(1, (nowMs - plantedAtMs) / duration));
  const stage = (progress >= 1 ? 3 : progress >= 0.66 ? 2 : progress >= 0.28 ? 1 : 0) as 0 | 1 | 2 | 3;
  return { stage, ready: progress >= 1, progress };
}
export function saleValue(speciesId: SpeciesId, quantity: number): number { if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive integer"); return getSpecies(speciesId).salePrice * quantity; }
export function xpForSale(speciesId: SpeciesId, quantity: number): number { if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive integer"); return getSpecies(speciesId).xpReward * quantity; }
export function levelForXp(xp: number): number { return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1); }
export function canUnlock(speciesId: SpeciesId, level: number): boolean { return level >= getSpecies(speciesId).unlockLevel; }
export function canPlaceAt(x: number, y: number, occupied: ReadonlyArray<{ x: number; y: number }>): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < 20 && y < 20 && !occupied.some((tile) => tile.x === x && tile.y === y);
}
