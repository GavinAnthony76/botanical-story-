import { expect, test } from "@playwright/test";
test("new guest can open the nursery and see the starter seeds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Willowbrook Nursery")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sunny Daisy").first()).toBeVisible();
  await expect(page.getByText("Tap an empty garden tile to plant a daisy.")).toBeVisible();
});
