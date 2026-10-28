import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("shows cycle time and overdue cards and opens an overdue card", async ({ page }) => {
  await page.getByLabel("New card title").fill("Pay rent");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByLabel('Due date for "Pay rent"', { exact: true }).fill("2000-01-01");

  await page.getByLabel("New card title").fill("Ship it");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByRole("button", { name: 'Move "Ship it" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Ship it" to Done' }).click();

  const opener = page.getByRole("button", { name: "Board insights" });
  await opener.click();
  const panel = page.getByRole("dialog", { name: "Board insights" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Median")).toBeVisible();
  await expect(panel.getByText("Average")).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Open "Pay rent" \(due / })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await panel.getByRole("button", { name: /^Open "Pay rent" \(due / }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Pay rent" })).toBeVisible();
});

test("does not scroll horizontally on a phone-width screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.getByLabel("New card title").fill("A very long card title that should wrap instead of overflowing the dialog");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByRole("button", { name: "Board insights" }).click();
  await expect(page.getByRole("dialog", { name: "Board insights" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
