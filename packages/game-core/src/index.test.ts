import { describe, expect, it } from "vitest";
import { canPlaceAt, canUnlock, growthState, levelForXp, saleValue, xpForSale } from "./index";
describe("nursery simulation", () => {
  it("derives growth from timestamps and caps at ready", () => {
    expect(growthState(1000, 11000, 1000)).toEqual({ stage: 0, ready: false, progress: 0 });
    expect(growthState(1000, 11000, 5000).stage).toBe(1);
    expect(growthState(1000, 11000, 8000).stage).toBe(2);
    expect(growthState(1000, 11000, 15000)).toEqual({ stage: 3, ready: true, progress: 1 });
  });
  it("prices sales and XP from species data", () => { expect(saleValue("daisy", 2)).toBe(24); expect(xpForSale("lavender", 3)).toBe(24); });
  it("levels at 100 XP and gates later seeds", () => { expect(levelForXp(0)).toBe(1); expect(levelForXp(299)).toBe(3); expect(canUnlock("daisy", 1)).toBe(true); expect(canUnlock("rose", 3)).toBe(false); });
  it("only places on an empty in-bounds tile", () => { expect(canPlaceAt(2, 4, [{x:1,y:1}])).toBe(true); expect(canPlaceAt(2, 4, [{x:2,y:4}])).toBe(false); expect(canPlaceAt(20, 4, [])).toBe(false); });
});
