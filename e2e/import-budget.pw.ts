import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

test.beforeAll(() => {
  execFileSync("bun", ["src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "html", "--out", "dist/import-budget.html"]);
});
for (const mode of ["served", "offline"]) {
  test(`${mode} snapshot comparison refuses oversized files and supports cancel/retry`, async ({ page }) => {
    // oracle: a refused/canceled import cannot replace the project; a subsequent valid import still works.
    await page.goto(mode === "served" ? "http://127.0.0.1:4178" : pathToFileURL(resolve("dist/import-budget.html")).href);
    await page.getByRole("button", { name: "Import/Export", exact: true }).click();
    await page.getByLabel("Compare snapshot JSON").setInputFiles({ name: "large.json", mimeType: "application/json", buffer: Buffer.alloc(8 * 1024 * 1024 + 1, " ") });
    await expect(page.locator("#changes-status")).toContainText("maximum file size is 8 MiB");
    await page.evaluate(() => {
      const input = document.querySelector("#compare-snapshot");
      if (!(input instanceof HTMLInputElement)) { throw new Error("Missing file input"); }
      const transfer = new DataTransfer();
      transfer.items.add(new File(['{"schema":"yalikedags/snapshot/2","tasks":[]}'], "canceled.json"));
      input.files = transfer.files; input.dispatchEvent(new Event("change"));
      const cancel = document.querySelector("#cancel-comparison");
      if (!(cancel instanceof HTMLButtonElement) || cancel.hidden) { throw new Error("No active cancellation control"); }
      cancel.click();
    });
    await expect(page.locator("#changes-status")).toContainText("canceled");
    await expect(page.locator("#cancel-comparison")).toBeHidden();
    await page.getByLabel("Compare snapshot JSON").setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from('{"schema":"yalikedags/snapshot/2","tasks":[]}') });
    await expect(page.locator("#changes-status")).toContainText("changes since");
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(page.locator("#table-count")).toContainText("12 of 12");
  });
}
