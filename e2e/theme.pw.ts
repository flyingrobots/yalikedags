import { THEMES } from "../src/viewer/ThemeCatalog.ts";
import { test, expect } from "@playwright/test";

for (const { id: palette } of THEMES) {
 for (const theme of ["dark", "light"]) {
  const variant = `${palette}-${theme}`;
  test(`${variant} theme meets text contrast and supports component overrides`, async ({ page }) => {
    await page.goto("http://127.0.0.1:4178");
    await expect(page.locator("#frontier .card").first()).toBeVisible();
    const ratios = await page.evaluate(({ name, family }) => {
      document.documentElement.dataset["theme"] = name;
      document.documentElement.dataset["palette"] = family;
      const style = getComputedStyle(document.documentElement);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context === null) { throw new Error("Canvas unavailable"); }
      const luminance = (token: string): number => {
        context.fillStyle = style.getPropertyValue(`--${token}`).trim();
        context.fillRect(0, 0, 1, 1);
        const pixels = context.getImageData(0, 0, 1, 1).data;
        const channels = [0, 1, 2].map((i) => {
          const channel = (pixels[i] ?? 0) / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return (channels[0] ?? 0) * .2126 + (channels[1] ?? 0) * .7152 + (channels[2] ?? 0) * .0722;
      };
      const results: Record<string, number> = {};
      for (const foreground of ["ink", "muted", "accent", "ready", "progress", "blocked", "unresolved", "done"]) {
        for (const background of ["canvas", "surface", "raised", "hover"]) {
          const a = luminance(foreground); const b = luminance(background);
          results[`${foreground}/${background}`] = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        }
      }
      for (const state of ["ready", "progress", "blocked", "unresolved", "done"]) {
        for (const foreground of ["ink", "muted", state]) {
          const a = luminance(foreground); const b = luminance(`${state}-fill`);
          results[`${foreground}/${state}-fill`] = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        }
      }
      return results;
    }, { name: theme, family: palette });
    for (const [pair, ratio] of Object.entries(ratios)) { expect(ratio, `${theme}: ${pair}`).toBeGreaterThanOrEqual(4.5); }
    await page.addStyleTag({ content: ':root[data-theme][data-palette] { --ui-button-border-radius: 19px; --ui-button-padding: 17px; --ui-root-font: 16px/1.5 monospace; --ready: rgb(12, 200, 130); --ui-graph-node-gatekeeper-dash: 9 5; }' });
    await expect(page.locator("#appearance-toggle")).toBeVisible();
    await expect(page.locator(".primary-nav button").first()).toHaveCSS("font-family", "monospace");
    await expect(page.locator("#frontier .card").first()).toHaveCSS("border-top-color", "rgb(12, 200, 130)");
    await page.getByRole("button", { name: "Dependencies", exact: true }).click();
    await expect(page.locator('[data-action="fit"]')).toHaveCSS("border-radius", "19px");
    await expect(page.locator('[data-action="fit"]')).toHaveCSS("padding-top", "17px");
    await expect(page.locator("#graph .node.ready rect").first()).toHaveCSS("stroke", "rgb(12, 200, 130)");
    await expect(page.locator("#graph .node.gatekeeper rect").first()).toHaveCSS("stroke-dasharray", "9px, 5px");
  });
}

}
