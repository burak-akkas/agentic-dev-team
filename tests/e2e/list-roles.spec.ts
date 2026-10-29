import { expect, test } from "@playwright/test";

test("a renamed Done list keeps its marker, no overdue chip and Archive done", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();

  await page.getByLabel("New card title").fill("Old task");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByLabel('Due date for "Old task"', { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: 'Move "Old task" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Old task" to Done' }).click();

  await page.getByRole("button", { name: "Manage lists" }).click();
  const dialog = page.getByRole("dialog", { name: "Manage lists" });
  await dialog.getByLabel('Name of list "Done"').fill("Shipped");
  await dialog.getByRole("button", { name: 'Rename list "Done"' }).click();
  await page.keyboard.press("Escape");

  const shipped = page.getByRole("region", { name: /^Shipped/ });
  await expect(shipped.getByText("Done list")).toBeVisible();
  await expect(page.getByRole("region", { name: /^Doing/ }).getByText("In progress list")).toBeVisible();

  await expect(shipped.getByText("Old task")).toBeVisible();
  await expect(shipped.getByText("Overdue")).toHaveCount(0);

  await shipped.getByRole("button", { name: "Archive done" }).click();
  await expect(page.getByRole("button", { name: "Archived (1)" })).toBeVisible();
});
