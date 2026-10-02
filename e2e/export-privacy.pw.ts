import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
  new Task({ id: "PRIVATE-a", title: "PRIVATE-title", description: "PRIVATE-description", assignee: "PRIVATE-person" }),
  new Task({ id: "PRIVATE-b", title: "PRIVATE-dependent", blockedBy: ["PRIVATE-a"] }),
], "PRIVATE-project");
const exported = pathToFileURL(resolve("dist/viewer-export-privacy.html")).href;
test.beforeAll(() => { mkdirSync("dist", { recursive: true }); writeFileSync("dist/viewer-export-privacy.html", new HtmlRendererAdapter().render(analysis)); });

for (const mode of ["server", "offline"]) {
  test(`export contents are explicit and structure-only preserves the current ${mode} workspace`, async ({ page }) => {
    // oracle: full download retains the sentinel, structure-only removes it, current UI retains it.
    if (mode === "server") {
      await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
    }
    await page.goto(mode === "server" ? "http://127.0.0.1:4178" : exported);
    await page.getByRole("button", { name: "Import/Export" }).click();
    await expect(page.getByLabel("Export content")).toHaveValue("full");
    await expect(page.locator("#export-warning")).toContainText("descriptions");
    for (const content of ["structure", "full"]) {
      await page.getByLabel("Export content").selectOption(content);
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export snapshot JSON" }).click();
      const download = await pending;
      const path = await download.path();
      const text = readFileSync(path, "utf8");
      expect(text.includes("PRIVATE-")).toBe(content === "full");
      expect(download.suggestedFilename()).toBe(content === "full" ? "yalikedags-snapshot.json" : "yalikedags-structure.json");
    }
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(page.locator("#task-table tbody")).toContainText("PRIVATE-title");
  });
}
