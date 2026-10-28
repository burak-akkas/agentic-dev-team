import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Kanban" })).toBeVisible();
});

async function addCard(page: Page, title: string) {
  await page.getByLabel("New card title").fill(title);
  await page.getByRole("button", { name: "Add card" }).click();
}

test("edits every field in the dialog, saves, and persists", async ({ page }) => {
  await addCard(page, "Plan trip");
  await page.getByRole("button", { name: "Plan trip", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Plan trip" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Plan trip" })).toBeVisible();
  await expect(dialog.getByText(/^Created/)).toBeVisible();

  await dialog.getByLabel("Title").fill("Plan holiday");
  await dialog.getByLabel("Description").fill("Book flights\nPack bags");
  await dialog.getByLabel("Status").selectOption("doing");
  await dialog.getByLabel("Priority").selectOption("high");
  await dialog.getByLabel("Due date").fill("2031-05-06");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  const doing = page.getByRole("region", { name: /^Doing/ });
  await expect(doing.getByRole("button", { name: "Plan holiday", exact: true })).toBeVisible();
  await expect(doing.getByTestId("priority-badge")).toHaveText("High");
  await expect(doing.getByText("Has notes")).toBeVisible();
  await expect(doing.getByRole("button", { name: "Plan holiday", exact: true })).toBeFocused();

  await page.reload();
  await page.getByRole("button", { name: "Plan holiday", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Plan holiday" });
  await expect(reopened.getByLabel("Description")).toHaveValue("Book flights\nPack bags");
  await expect(reopened.getByLabel("Status")).toHaveValue("doing");
  await expect(reopened.getByLabel("Due date")).toHaveValue("2031-05-06");

  await reopened.getByRole("button", { name: "Clear due date" }).click();
  await reopened.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Plan holiday", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Due date")).toHaveValue("");
});

test("blocks Save for an empty title", async ({ page }) => {
  await addCard(page, "Plan trip");
  await page.getByRole("button", { name: "Plan trip", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("   ");
  await expect(dialog.getByRole("alert")).toHaveText("Title must not be empty");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("cancel, Escape and backdrop confirm before discarding changes", async ({ page }) => {
  await addCard(page, "Plan trip");
  const open = page.getByRole("button", { name: "Plan trip", exact: true });
  const dialog = page.getByRole("dialog");

  // No changes: closes without asking.
  page.once("dialog", (d) => {
    throw new Error(`unexpected confirm: ${d.message()}`);
  });
  await open.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  page.removeAllListeners("dialog");

  // Dirty + decline: stays open.
  await open.click();
  await dialog.getByLabel("Title").fill("Changed");
  page.once("dialog", (d) => void d.dismiss());
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeVisible();

  page.once("dialog", (d) => void d.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // Dirty + accept via Escape: discarded and focus returns to the card.
  page.once("dialog", (d) => void d.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(open).toHaveText("Plan trip");

  // Backdrop click (top-left corner, outside the centred dialog).
  await open.click();
  await dialog.getByLabel("Title").fill("Changed again");
  page.once("dialog", (d) => void d.accept());
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(open).toHaveText("Plan trip");
});

test("deleting asks for confirmation", async ({ page }) => {
  await addCard(page, "Plan trip");
  await page.getByRole("button", { name: "Plan trip", exact: true }).click();
  const dialog = page.getByRole("dialog");

  page.once("dialog", (d) => void d.dismiss());
  await dialog.getByRole("button", { name: "Delete card" }).click();
  await expect(dialog).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await dialog.getByRole("button", { name: "Delete card" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Plan trip", exact: true })).toHaveCount(0);
});

test("works by keyboard, traps focus and returns focus", async ({ page }) => {
  await addCard(page, "Plan trip");
  const open = page.getByRole("button", { name: "Plan trip", exact: true });
  await open.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Plan trip" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // Focus may briefly leave the page for the browser UI, but never lands on the inert board behind.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const behindDialog = await page.evaluate(() => {
      const active = document.activeElement;
      return !!active && active !== document.body && !active.closest("dialog");
    });
    expect(behindDialog).toBe(false);
  }
  await dialog.getByLabel("Title").focus();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("fits a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await addCard(page, "Plan trip");
  await page.getByRole("button", { name: "Plan trip", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  expect(box?.height).toBeLessThanOrEqual(500);
  const save = dialog.getByRole("button", { name: "Save" });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
});

test("renders in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await addCard(page, "Plan trip");
  await page.getByRole("button", { name: "Plan trip", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveCSS("background-color", "rgb(255, 255, 255)");
});
