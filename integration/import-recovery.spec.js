const { test, expect } = require("@playwright/test");
const { importFile, markers } = require("../e2e/helpers.cjs");

for (const [name, contents, error] of [
  ["broken.csv", "x,y\n1,2\n3,nope", /Row 3/],
  ["broken.xml", '<points><point x="1" y="2"/><point x="3"/></points>', /Point 2/]
]) {
  test(`${name} rejection preserves data, appearance, scale and zoom`, async ({ page }) => {
    await page.goto("/");
    await importFile(page, "valid.csv", "x,y\n1,2\n2,4\n3,8");
    await page.getByLabel("Color for y").fill("#123456");
    await page.locator("#x-label").fill("Elapsed time");
    await page.locator("#log-y").click();
    await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-status")).toHaveText(/Zoomed/);
    const labels = await markers(page, "line").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    const zoom = await page.locator("#zoom-status").textContent();
    await importFile(page, name, contents);
    await expect(page.locator("#status")).toHaveClass(/error/);
    await expect(page.locator("#status")).toHaveText(error);
    expect(await markers(page, "line").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))).toEqual(labels);
    await expect(page.locator("#zoom-status")).toHaveText(zoom);
    await expect(page.locator("#line-chart polyline.line")).toHaveAttribute("stroke", "#123456");
    for (const chart of ["line", "scatter"]) {
      await expect(page.locator(`#${chart}-chart text.axis-label`)).toHaveText(["Elapsed time", "y (log)"]);
    }
    await expect(page.locator("#import-button")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Export line graph image" })).toBeEnabled();
  });
}

test("a corrected file with the same name can be imported after rejection", async ({ page }) => {
  await page.goto("/");
  await importFile(page, "measurements.csv", "x,y\n1,invalid");
  await expect(page.locator("#status")).toHaveClass(/error/);
  await importFile(page, "measurements.csv", "x,y\n1,2\n3,4");
  await expect(page.locator("#status")).toHaveText("Imported measurements.csv. Points: 2.");
  await expect(page.locator("#status")).not.toHaveClass(/error/);
  for (const chart of ["line", "scatter"]) await expect(markers(page, chart)).toHaveCount(2);
});
