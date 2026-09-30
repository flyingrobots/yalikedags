import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.pw.ts",
  use: { browserName: "chromium", viewport: { width: 1440, height: 960 } },
  webServer: {
    command: "bun src/cli.ts serve --tasklist examples/example-tasklist.txt --port 4178",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    cwd: "..",
  },
});
