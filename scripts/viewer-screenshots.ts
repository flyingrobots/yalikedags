import { dockWaveGrid } from "../e2e/workspace.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { TaskListParserAdapter } from "../src/adapters/input/TaskListParserAdapter.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";

/** Reproducible documentation screenshots from the public bundled example only. */
const text = await Bun.file("examples/example-tasklist.txt").text();
const tasks = await new TaskListParserAdapter(text, "examples/example-tasklist.txt").load();
const analysis = new AnalysisService({ today: (): string => "2026-09-28", now: (): string => "2026-09-28T12:00:00.000Z" }).analyse(tasks, "Bundled example");
await Bun.write("dist/viewer-example.html", new HtmlRendererAdapter().render(analysis));
await mkdir("docs/images", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve("dist/viewer-example.html")).href);
  await page.locator("body[data-ready]").waitFor();
  await page.screenshot({ path: "docs/images/viewer-overview.png" });
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Implement core DAG");
  await page.locator("#search-results button").first().click();
  await page.screenshot({ path: "docs/images/viewer-selection.png" });
  await dockWaveGrid(page);
  await page.getByRole("button", { name: "Focus selection", exact: true }).click();
  await page.screenshot({ path: "docs/images/viewer-split.png" });
  await page.getByRole("button", { name: "Show task table", exact: true }).click();
  await page.screenshot({ path: "docs/images/viewer-table.png" });
} finally { await browser.close(); }
console.log("viewer screenshots written to docs/images/");
