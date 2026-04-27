import { expect, test } from "@playwright/test";

test("login screen renders core access controls", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Authorize Frontend Session")).toBeVisible();
  await expect(page.getByText("Use Mock Session")).toBeVisible();
});
