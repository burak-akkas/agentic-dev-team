import { expect, test, type Page } from "@playwright/test";
import { moveCardTo } from "../support/cardActions";

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

async function addCard(page: Page, title: string) {
  await page.getByLabel("New card title").fill(title);
  await page.getByRole("button", { name: "Add card" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("sets a WIP limit, warns at and over it, persists and clears", async ({ page }) => {
  const doing = column(page, "Doing");
  await addCard(page, "One");
  await addCard(page, "Two");

  await page.getByRole("button", { name: "Set WIP limit for Doing" }).click();
  const input = page.getByRole("textbox", { name: "WIP limit for Doing" });
  await input.fill("0");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(doing.getByRole("alert")).toContainText("Enter a whole number");

  await input.fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: /^Doing\s*0 \/ 1$/ })).toBeVisible();

  await moveCardTo(page, "One", "Doing");
  await expect(doing.getByText("At limit")).toBeVisible();

  await moveCardTo(page, "Two", "Doing");
  await expect(doing.getByText("Over limit by 1")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /^Doing\s*2 \/ 1$/ })).toBeVisible();
  await expect(column(page, "Doing").getByText("Over limit by 1")).toBeVisible();

  await page.getByRole("button", { name: "Edit WIP limit for Doing" }).click();
  await page.getByRole("button", { name: "Clear WIP limit for Doing" }).click();
  await expect(page.getByRole("heading", { name: /^Doing\s*2$/ })).toBeVisible();
  await expect(page.getByText(/Over limit by/)).toHaveCount(0);
});
