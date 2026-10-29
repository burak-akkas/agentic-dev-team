import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("adds, persists, expands, edits and removes notes", async ({ page }) => {
  await page.getByLabel("New card title").fill("Plan trip");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("Has notes")).toHaveCount(0);

  await page.getByRole("button", { name: 'Add notes for "Plan trip"' }).click();
  const notes = page.getByLabel('Notes for "Plan trip"');
  await notes.fill("Book flights\nPack bags");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Has notes")).toBeVisible();
  await expect(page.getByText("Book flights")).toBeVisible();
  await expect(page.getByText("Pack bags")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Has notes")).toBeVisible();
  await page.getByRole("button", { name: "Show notes" }).click();
  await expect(page.getByRole("button", { name: "Hide notes" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Pack bags")).toBeVisible();

  await page.getByRole("button", { name: 'Edit notes for "Plan trip"' }).click();
  await notes.fill("Changed");
  await notes.press("Escape");
  await expect(page.getByRole("button", { name: 'Edit notes for "Plan trip"' })).toBeFocused();
  await expect(page.getByText("Pack bags")).toBeVisible();

  await page.getByRole("button", { name: 'Edit notes for "Plan trip"' }).click();
  await notes.fill("Changed");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Changed")).toBeVisible();

  await page.getByRole("button", { name: 'Edit notes for "Plan trip"' }).click();
  await page.getByRole("button", { name: "Remove notes" }).click();
  await expect(page.getByText("Has notes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: 'Add notes for "Plan trip"' })).toBeFocused();
});
