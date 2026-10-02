import type { Page } from "@playwright/test";

/** User-facing navigation; snapshot actions are the only disclosure. */
export async function workspaceAction(page: Page, name: string): Promise<void> {
  const titles = new Map([["Show DAG", "Dependencies"], ["Show wave grid", "Waves"], ["Show task table", "Tasks"]]);
  const title = titles.get(name) ?? name;
  if (name === "Refresh source") { await page.getByRole("button", { name: "Import/Export", exact: true }).click(); }
  await page.getByRole("button", { name: title, exact: true }).click();
}
