import type { Page } from "@playwright/test";

/** Exercise Dockview's actual drag gesture, including its sibling drop-surface overlay. */
export async function dockWaveGrid(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "DAG", exact: true }).click();
  const group = page.locator(".dv-groupview").first();
  const bounds = await group.boundingBox();
  if (bounds === null) { throw new Error("Missing docking group"); }
  await page.getByRole("tab", { name: "Wave grid", exact: true }).dragTo(group, {
    force: true, targetPosition: { x: bounds.width / 2, y: bounds.height - 15 },
  });
}
