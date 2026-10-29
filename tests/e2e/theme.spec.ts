import { expect, test } from "@playwright/test";

const html = "html";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

test("System is selected by default", async ({ page }) => {
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(page.locator(html)).toHaveAttribute("data-theme", "light");
});

test("Dark applies immediately and persists across a reload", async ({ page }) => {
  await page.getByRole("radio", { name: "Dark" }).check({ force: true });
  await expect(page.locator(html)).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 10, 10)");

  await page.reload();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page.locator(html)).toHaveAttribute("data-theme", "dark");
});

test("Light overrides a dark OS scheme and System follows it again", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("radio", { name: "Light" }).check({ force: true });
  await expect(page.locator(html)).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await page.getByRole("radio", { name: "System" }).check({ force: true });
  await expect(page.locator(html)).toHaveAttribute("data-theme", "dark");
});
