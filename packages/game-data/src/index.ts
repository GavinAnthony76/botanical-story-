import type { SpeciesId } from "@botanical-story/shared";
export interface SpeciesDefinition { id: SpeciesId; name: string; seedPrice: number; growthMs: number; salePrice: number; xpReward: number; unlockLevel: number; color: string; emoji: string }
// Versioned provisional tuning. Intro crops grow quickly so the first-session loop is achievable.
export const GAME_DATA_VERSION = 1;
export const SPECIES: readonly SpeciesDefinition[] = [
  { id: "daisy", name: "Sunny Daisy", seedPrice: 5, growthMs: 20_000, salePrice: 12, xpReward: 5, unlockLevel: 1, color: "#f8df68", emoji: "🌼" },
  { id: "lavender", name: "Lavender", seedPrice: 9, growthMs: 45_000, salePrice: 21, xpReward: 8, unlockLevel: 1, color: "#9b83d6", emoji: "💜" },
  { id: "tulip", name: "Tulip", seedPrice: 14, growthMs: 90_000, salePrice: 32, xpReward: 12, unlockLevel: 2, color: "#ef788a", emoji: "🌷" },
  { id: "sunflower", name: "Sunflower", seedPrice: 22, growthMs: 180_000, salePrice: 49, xpReward: 18, unlockLevel: 3, color: "#f6a444", emoji: "🌻" },
  { id: "rose", name: "Garden Rose", seedPrice: 34, growthMs: 360_000, salePrice: 76, xpReward: 28, unlockLevel: 4, color: "#dc6f85", emoji: "🌹" },
  { id: "orchid", name: "Moon Orchid", seedPrice: 55, growthMs: 600_000, salePrice: 120, xpReward: 42, unlockLevel: 5, color: "#c58ad7", emoji: "🪻" }
];
export function getSpecies(id: SpeciesId): SpeciesDefinition { const species = SPECIES.find((item) => item.id === id); if (!species) throw new Error("Unknown plant species"); return species; }
