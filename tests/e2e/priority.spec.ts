import { expect, test, type Page } from "@playwright/test";

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("changes a card's priority and keeps it after a reload and a move", async ({ page }) => {
  await page.getByLabel("New card title").fill("Urgent thing");
  await page.getByRole("button", { name: "Add card" }).click();

  const select = page.getByLabel('Priority of "Urgent thing"');
  const card = column(page, "To do").getByRole("listitem");
  await expect(select).toHaveValue("medium");
  await expect(card.getByText("Medium", { exact: true }).first()).toBeVisible();

  await select.selectOption("high");
  await expect(select).toHaveValue("high");
  await expect(card.getByTestId("priority-badge")).toHaveText("High");

  await page.reload();
  await expect(page.getByLabel('Priority of "Urgent thing"')).toHaveValue("high");

  await page.getByRole("button", { name: 'Move "Urgent thing" to Doing' }).click();
  await expect(column(page, "Doing").getByTestId("priority-badge")).toHaveText("High");
});
