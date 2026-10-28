import { expect, test, type Page } from "@playwright/test";

// Every test gets a fresh browser context, so localStorage starts empty.
// page.goto("./") resolves against baseURL, which also works for PR previews under /<repo>/pr-N/.

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

async function addCard(page: Page, title: string) {
  await page.getByLabel("New card title").fill(title);
  await page.getByRole("button", { name: "Add card" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("shows three empty columns", async ({ page }) => {
  for (const name of ["To do", "Doing", "Done"]) {
    await expect(column(page, name).getByText("No cards")).toBeVisible();
  }
});

test("adds a card to To do", async ({ page }) => {
  await addCard(page, "Write the e2e suite");
  await expect(column(page, "To do").getByText("Write the e2e suite")).toBeVisible();
  await expect(page.getByLabel("New card title")).toHaveValue("");
});

test("moves a card across the board and back", async ({ page }) => {
  await addCard(page, "Ship it");
  await page.getByRole("button", { name: 'Move "Ship it" to Doing' }).click();
  await page.getByRole("button", { name: 'Move "Ship it" to Done' }).click();
  await expect(column(page, "Done").getByText("Ship it")).toBeVisible();

  await page.getByRole("button", { name: 'Move "Ship it" to Doing' }).click();
  await expect(column(page, "Doing").getByText("Ship it")).toBeVisible();
  await expect(column(page, "Done").getByText("No cards")).toBeVisible();
});

test("deletes a card", async ({ page }) => {
  await addCard(page, "Oops");
  await page.getByRole("button", { name: 'Delete "Oops"' }).click();
  await expect(page.getByText("Oops")).toHaveCount(0);
});

test("keeps cards after a reload", async ({ page }) => {
  await addCard(page, "Remember me");
  await page.reload();
  await expect(column(page, "To do").getByText("Remember me")).toBeVisible();
});

test("filters cards with the search box", async ({ page }) => {
  await addCard(page, "Write docs");
  await addCard(page, "Fix bug");
  await page.getByRole("button", { name: 'Move "Fix bug" to Doing' }).click();

  const search = page.getByLabel("Search cards");
  await search.fill("DOCS");
  await expect(column(page, "To do").getByText("Write docs")).toBeVisible();
  await expect(page.getByText("Fix bug")).toHaveCount(0);
  await expect(column(page, "Doing").getByText("No matching cards")).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(column(page, "Doing").getByText("Fix bug")).toBeVisible();

  await search.fill("zzz");
  await expect(column(page, "To do").getByText("No matching cards")).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(column(page, "To do").getByText("Write docs")).toBeVisible();

  await search.fill("docs");
  await page.reload();
  await expect(page.getByLabel("Search cards")).toHaveValue("");
  await expect(column(page, "Doing").getByText("Fix bug")).toBeVisible();
});
