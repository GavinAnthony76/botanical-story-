import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { PlayerState } from "@botanical-story/shared";

test("guest can plant, harvest, sell, and reinvest in the nursery UI", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const state: PlayerState = {
    playerId: "00000000-0000-4000-8000-000000000001", coins: 100, xp: 0, level: 1, tutorialComplete: false,
    inventory: [
      { speciesId: "daisy", seeds: 3, plants: 0 }, { speciesId: "lavender", seeds: 0, plants: 0 },
      { speciesId: "tulip", seeds: 0, plants: 0 }, { speciesId: "sunflower", seeds: 0, plants: 0 },
      { speciesId: "rose", seeds: 0, plants: 0 }, { speciesId: "orchid", seeds: 0, plants: 0 }
    ], plants: [], decorations: []
  };
  const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (!process.env.E2E_LIVE_API) await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/guest") return route.fulfill(json({ playerId: state.playerId, token: "e2e-session" }, 201));
    if (path === "/api/state") return route.fulfill(json(state));
    if (path === "/api/plants" && route.request().method() === "POST") {
      const input = route.request().postDataJSON() as { speciesId: "daisy"; x: number; y: number };
      state.inventory[0].seeds -= 1;
      state.plants.push({ id: "00000000-0000-4000-8000-000000000002", speciesId: input.speciesId, x: input.x, y: input.y, plantedAt: new Date(Date.now() - 30_000).toISOString(), harvestAt: new Date(Date.now() - 1_000).toISOString(), status: "growing" });
      return route.fulfill(json({ ok: true }, 201));
    }
    if (path === "/api/plants/harvest") {
      state.plants[0].status = "harvested"; state.inventory[0].plants += 1; state.xp += 5;
      return route.fulfill(json({ ok: true, xp: 5 }));
    }
    if (path === "/api/plants/sell") {
      state.inventory[0].plants -= 1; state.coins += 12; state.xp += 5;
      return route.fulfill(json({ ok: true, coins: 12, xp: 5 }));
    }
    if (path === "/api/seeds/buy") {
      state.coins -= 5; state.inventory[0].seeds += 1;
      return route.fulfill(json({ ok: true }));
    }
    if (path === "/api/tutorial/complete") { state.tutorialComplete = true; return route.fulfill(json({ ok: true })); }
    return route.fulfill(json({ error: "Unexpected mocked API request" }, 404));
  });
  await page.goto("/");
  await expect(page.getByText("Willowbrook Nursery")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sunny Daisy").first()).toBeVisible();
  await expect(page.getByText("Tap an empty garden tile to plant a daisy.")).toBeVisible();
  const canvas = page.locator(".nursery-canvas canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Nursery canvas has no size");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".quick-counts strong").first()).toHaveText("1");
  if (process.env.E2E_LIVE_API) {
    await page.reload();
    await expect(page.locator(".quick-counts strong").first()).toHaveText("1");
    await page.waitForTimeout(21_000);
  }
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/botanical-story-nursery.png", fullPage: true });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("button", { name: /Sell 1 · 12/ })).toBeVisible();
  await page.getByRole("button", { name: /Sell 1 · 12/ }).click();
  await expect(page.locator(".coin-pill strong")).toHaveText("112");
  await expect(page.getByText("Your first blooms will land here.")).toBeVisible();
  await page.getByRole("button", { name: "Open seed shop" }).click();
  await page.getByRole("button", { name: "Buy · 5 ✦", exact: true }).click();
  await expect(page.locator(".coin-pill strong")).toHaveText("107");
  expect(browserErrors).toEqual([]);
});
