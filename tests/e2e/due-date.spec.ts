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
  await expect(column(page, "To do").getByText("Overdue")).toBeVisible();

  await page.getByRole("button", { name: 'Move "Pay rent" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Pay rent" to Done' }).click();
  await expect(column(page, "Done").getByText("Pay rent")).toBeVisible();
  await expect(column(page, "Done").getByText("Overdue")).toHaveCount(0);
  await expect(input).toHaveValue("2000-01-01");

  await page.getByRole("button", { name: 'Clear due date for "Pay rent"' }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("shows due today and due tomorrow chips, but none for later dates or the done list", async ({ page }) => {
  await page.getByLabel("New card title").fill("Soon");
  await page.getByRole("button", { name: "Add card" }).click();

  const [today, tomorrow, later] = await page.evaluate(() => {
    const fmt = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    };
    return [fmt(0), fmt(1), fmt(5)];
  });

  const input = page.getByLabel('Due date for "Soon"', { exact: true });
  await input.fill(today);
  await expect(column(page, "To do").getByText("Due today")).toBeVisible();
  await input.fill(tomorrow);
  await expect(column(page, "To do").getByText("Due tomorrow")).toBeVisible();
  await expect(column(page, "To do").getByText("Due today")).toHaveCount(0);
  await input.fill(later);
  await expect(column(page, "To do").getByText(/^Due (today|tomorrow)$/)).toHaveCount(0);

  await input.fill(today);
  await page.getByRole("button", { name: 'Move "Soon" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Soon" to Done' }).click();
  await expect(column(page, "Done").getByText("Due today")).toHaveCount(0);
});
