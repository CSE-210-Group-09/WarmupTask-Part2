// Browser tests: integration/ (one spec per user story, `npm run test:integration`)
// and e2e/ (workflows across stories, `npm run test:e2e`). See docs/testing.md.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: ["integration/**/*.spec.js", "e2e/**/*.spec.js"],
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4321" },
  webServer: {
    command: "node e2e/server.cjs",
    url: "http://127.0.0.1:4321/",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ]
});
