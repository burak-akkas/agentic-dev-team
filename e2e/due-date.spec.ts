import { expect, test, type Page } from "@playwright/test";

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("sets a due date, shows it overdue, persists it and clears it", async ({ page }) => {
  await page.getByLabel("New card title").fill("Pay rent");
  await page.getByRole("button", { name: "Add card" }).click();

  const input = page.getByLabel('Due date for "Pay rent"', { exact: true });
  await input.fill("2000-01-01");
  await expect(column(page, "To do").getByText("Jan 1")).toBeVisible();
  await expect(column(page, "To do").getByText("Overdue")).toBeVisible();

  await page.reload();
  await expect(input).toHaveValue("2000-01-01");
  await expect(page.getByText("Overdue")).toBeVisible();

  await page.getByRole("button", { name: 'Move "Pay rent" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Pay rent" to Done' }).click();
  await expect(column(page, "Done").getByText("Pay rent")).toBeVisible();
  await expect(page.getByText("Overdue")).toHaveCount(0);
  await expect(input).toHaveValue("2000-01-01");

  await page.getByRole("button", { name: 'Clear due date for "Pay rent"' }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});
