// Story: As a user, I don't want to be able to modify the chart after creating it.
const { test, expect } = require("@playwright/test");
const { importFile, markers } = require("../e2e/helpers.cjs");
const fs = require("node:fs");

test.beforeEach(async ({ page }) => {
  // Deleting used to ask for confirmation; any dialog now is a regression.
  page.on("dialog", (dialog) => { throw new Error(`Unexpected dialog: ${dialog.message()}`); });
  await page.goto("/");
  await importFile(page, "sample.csv", fs.readFileSync("sample.csv", "utf8"));
});

test("there are no controls for adding points", async ({ page }) => {
  await expect(page.locator("#point-form, #x-input, #y-input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /add/i })).toHaveCount(0);
  await expect(page.locator("main input[type=number]")).toHaveCount(0);
});

test("clicking a point does not delete it", async ({ page }) => {
  await expect(markers(page, "line")).toHaveCount(6);
  await markers(page, "line").nth(2).click();
  await markers(page, "scatter").nth(4).click();
  await expect(markers(page, "line")).toHaveCount(6);
  await expect(markers(page, "scatter")).toHaveCount(6);
});

test("Delete and Backspace on a focused point do not remove it", async ({ page }) => {
  const point = markers(page, "line").first();
  await point.focus();
  await expect(point).toBeFocused();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(markers(page, "line")).toHaveCount(6);
  await expect(page.locator("#status")).toHaveText("Imported sample.csv. Points: 6.");
});

test("the only way to change the data is importing a file again", async ({ page }) => {
  await importFile(page, "two.csv", "x,y\n1,1\n2,2");
  await expect(markers(page, "line")).toHaveCount(2);
  await expect(page.locator("#status")).toHaveText("Imported two.csv. Points: 2.");
});
