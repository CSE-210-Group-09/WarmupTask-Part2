// Story: As a user, I want to create a plot from an XML file.
const { test, expect } = require("@playwright/test");
const { importFile, markers } = require("./helpers.cjs");
const fs = require("node:fs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the sample XML plots the same points as the sample CSV", async ({ page }) => {
  await importFile(page, "sample.xml", fs.readFileSync("sample.xml", "utf8"));
  await expect(page.locator("#status")).toHaveText("Imported sample.xml. Points: 6.");
  const fromXml = await markers(page, "line").evaluateAll((c) => c.map((e) => e.getAttribute("aria-label")));
  await importFile(page, "sample.csv", fs.readFileSync("sample.csv", "utf8"));
  const fromCsv = await markers(page, "line").evaluateAll((c) => c.map((e) => e.getAttribute("aria-label")));
  expect(fromXml).toEqual(fromCsv);
  expect(fromXml).toHaveLength(6);
});

test("attribute, child-element and namespaced points all plot", async ({ page }) => {
  await importFile(page, "growth-data.xml", fs.readFileSync("test-data/growth-data.xml", "utf8"));
  await expect(markers(page, "scatter")).toHaveCount(12);
  await importFile(page, "ns.xml",
    '<d:points xmlns:d="urn:d"><d:point d:x="1" d:y="2"/><d:point><d:x>3</d:x><d:y>4</d:y></d:point></d:points>');
  await expect(page.locator("#status")).toHaveText("Imported ns.xml. Points: 2.");
});

test("a malformed or invalid XML file is rejected and the chart is kept", async ({ page }) => {
  await importFile(page, "sample.xml", fs.readFileSync("sample.xml", "utf8"));
  await importFile(page, "bad.xml", "<points><point x='1' y='2'></points>");
  await expect(page.locator("#status")).toHaveText("The XML is not well-formed.");
  await expect(page.locator("#status")).toHaveClass(/error/);
  await importFile(page, "missing.xml", '<points><point x="1" y="2"/><point x="3"/></points>');
  await expect(page.locator("#status")).toHaveText("Point 2 must contain exactly one valid number for x and for y.");
  // The first point defines the columns, so one field there is too few.
  await importFile(page, "one-field.xml", '<points><point x="1"/></points>');
  await expect(page.locator("#status")).toHaveText("The XML needs at least two columns.");
  await expect(markers(page, "line")).toHaveCount(6);
});
