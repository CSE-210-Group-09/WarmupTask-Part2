// Browser (integration) tests: `npm run test:e2e`. See docs/testing.md.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "e2e",
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
