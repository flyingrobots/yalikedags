import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { rec } from "../src/adapters/linear/GraphqlJson.ts";
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

/** Artifact-level release test. No package installation or tracker access on the destination. */
async function checksums(directory: string): Promise<number> {
  const sums = (await readFile(join(directory, "SHA256SUMS"), "utf8")).trim().split("\n");
  if (sums.length < 6) { throw new Error("Incomplete offline payload"); }
  for (const line of sums) {
    const [hash, name] = line.split("  ");
    if (name === undefined || name.includes("/") || name.includes("\\") || name === "..") { throw new Error("Invalid checksum path"); }
    if (createHash("sha256").update(await readFile(join(directory, name))).digest("hex") !== hash) { throw new Error(`Checksum mismatch: ${name}`); }
  }
  return sums.length;
}

async function verify(directory: string): Promise<void> {
  const count = await checksums(directory);
  const scratch = await mkdtemp(join(tmpdir(), "yalikedags-offline-"));
  try {
    const executable = join(directory, process.platform === "win32" ? "yalikedags.exe" : "yalikedags");
    const output = join(scratch, "viewer.html");
    for (const format of ["json", "html"]) {
      const command = [executable, "render", "--tasklist", join(directory, "example-tasklist.txt"), "--format", format, "--out", format === "html" ? output : join(scratch, "snapshot.json")];
      const child = Bun.spawn(command, { cwd: scratch, env: { PATH: scratch }, stdout: "pipe", stderr: "pipe" });
      const stderr = await new Response(child.stderr).text();
      if (await child.exited !== 0) { throw new Error(`Offline executable failed: ${stderr}`); }
    }
    await snapshotContract(join(scratch, "snapshot.json"));
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ offline: true });
      const page = await context.newPage(); const requests: string[] = [];
      page.on("request", (request) => { if (/^https?:/.test(request.url())) { requests.push(request.url()); } });
      await page.goto(pathToFileURL(output).href); await page.locator("body[data-ready]").waitFor();
      for (const name of ["Dependencies", "Waves", "Tasks", "Findings", "Import/Export"]) { await page.getByRole("button", { name, exact: true }).click(); }
      if (requests.length) { throw new Error("Offline viewer attempted network access"); }
    } finally { await browser.close(); }
  } finally { await rm(scratch, { recursive: true, force: true }); }
  console.log(`Verified ${String(count)} payload checksums and disconnected viewer workflows.`);
}
async function snapshotContract(path: string): Promise<void> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const data = rec(raw); const tasks = data["tasks"];
  if (data["schema"] !== "yalikedags/snapshot/2" || !Array.isArray(tasks) || tasks.length !== 12) { throw new Error("Unexpected example snapshot output"); }
}
await verify(resolve(process.argv[2] ?? `dist/offline-${process.platform}-${process.arch}`));
