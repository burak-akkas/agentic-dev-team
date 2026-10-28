import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("exports the board and imports it back after confirming", async ({ page }, testInfo) => {
  await page.getByLabel("New card title").fill("Backup me");
  await page.getByRole("button", { name: "Add card" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kanban-board-\d{4}-\d{2}-\d{2}\.json$/);
  const path = testInfo.outputPath("board.json");
  await download.saveAs(path);
  expect(await readFile(path, "utf8")).toContain("Backup me");

  await page.getByRole("button", { name: 'Delete "Backup me"' }).click();
  await expect(page.getByText("Backup me")).toHaveCount(0);

  await page.getByLabel("Import board file").setInputFiles(path);
  await expect(page.getByRole("alertdialog")).toContainText("Replace the current board");
  await page.getByRole("button", { name: "Replace" }).click();

  await expect(column(page, "To do").getByText("Backup me")).toBeVisible();
  await page.reload();
  await expect(column(page, "To do").getByText("Backup me")).toBeVisible();
});

test("rejects a foreign JSON file and keeps the board", async ({ page }) => {
  await page.getByLabel("New card title").fill("Keep me");
  await page.getByRole("button", { name: "Add card" }).click();

  await page.getByLabel("Import board file").setInputFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });

  await expect(page.getByRole("alert").filter({ hasText: "not a Kanban board" })).toBeVisible();
  await expect(column(page, "To do").getByText("Keep me")).toBeVisible();
});
