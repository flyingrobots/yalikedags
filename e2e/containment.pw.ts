import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test.beforeAll(() => {
  execFileSync("bun", ["src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "html", "--out", "dist/viewer-containment.html"]);
});

for (const mode of ["served", "offline"]) {
  test(`${mode} viewer blocks untrusted inline scripts while its bundled controls work`, async ({ page }) => {
    // oracle: a dynamically inserted non-bundled script must not execute, while real navigation still works.
    await page.goto(mode === "served" ? "http://127.0.0.1:4178" : pathToFileURL(resolve("dist/viewer-containment.html")).href);
    await page.locator("body[data-ready]").waitFor();
    await page.evaluate(() => {
      const script = document.createElement("script"); script.textContent = 'document.body.dataset.untrusted = "executed"';
      document.body.append(script);
    });
    await expect(page.locator("body")).not.toHaveAttribute("data-untrusted", "executed");
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.locator("#task-table tbody tr").first().click();
    await expect(page.locator("#inspector")).toBeVisible();
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(policy).toContain(mode === "served" ? "connect-src 'self'" : "connect-src 'none'");
  });
}

test("served data and HTML include browser containment headers", async ({ request }) => {
  for (const path of ["/", "/viewer.json", "/missing"]) {
    const response = await request.get(`http://127.0.0.1:4178${path}`);
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  }
});
