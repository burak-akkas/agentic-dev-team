import { expect, test, type Page } from "@playwright/test";

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

test("creates, switches, renames and deletes boards, remembering the last used one", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete board" })).toBeDisabled();

  await page.getByRole("button", { name: "New board" }).click();
  await expect(page.getByText(/up to 40 characters/i)).toBeVisible();
  await page.getByLabel("Board name").fill("my BOARD");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("already exists");
  await page.getByLabel("Board name").fill("Work");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("combobox", { name: "Board" })).toHaveValue(/.+/);
  await expect(page.getByRole("combobox", { name: "Board" }).locator("option:checked")).toHaveText("Work");

  await page.getByLabel("New card title").fill("Work card");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(column(page, "To do").getByText("Work card")).toBeVisible();

  await page.getByRole("combobox", { name: "Board" }).selectOption({ label: "My board" });
  await expect(page.getByText("Work card")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Board" }).selectOption({ label: "Work" });

  await page.getByRole("button", { name: "Rename board" }).click();
  await page.getByLabel("Board name").fill("Projects");
  await page.getByRole("button", { name: "Rename", exact: true }).click();

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Board" }).locator("option:checked")).toHaveText("Projects");
  await expect(column(page, "To do").getByText("Work card")).toBeVisible();

  await page.getByRole("button", { name: "Delete board" }).click();
  await expect(page.getByRole("dialog")).toContainText("and all its cards");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("combobox", { name: "Board" }).locator("option:checked")).toHaveText("My board");
  await expect(page.getByRole("button", { name: "Delete board" })).toBeDisabled();
});
