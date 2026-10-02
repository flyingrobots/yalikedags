import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";

// oracle: every supplied sensitive field shares a sentinel; only status and graph structure may survive.
test("[medium] redacted CLI exports remove content and provenance while retaining dependency structure", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "yalikedags-redact-"));
  try {
    const input = join(scratch, "PRIVATE-source.json");
    const identity = { id: "PRIVATE-person", name: "PRIVATE-name" };
    writeFileSync(input, JSON.stringify({ schema: "yalikedags/snapshot/2", source: "PRIVATE-source", capturedAt: "2026-09-30T12:00:00Z",
      warnings: ["PRIVATE-warning"], account: { user: identity, workspace: identity, project: identity }, tasks: [
        { id: "PRIVATE-a", key: "PRIVATE-key", title: "PRIVATE-title", description: "PRIVATE-description", status: "open", blockedBy: ["PRIVATE-external"], assignee: "PRIVATE-owner", assigneeId: "PRIVATE-owner-id", milestone: "PRIVATE-milestone", url: "https://example.invalid/PRIVATE-url", due: "2026-10-01", createdAt: "2026-09-30T12:00:00Z", priority: 1, effort: 8, children: ["PRIVATE-b"], labels: ["PRIVATE-label"], resources: ["PRIVATE-resource"] },
        { id: "PRIVATE-b", title: "PRIVATE-dependent", status: "open", blockedBy: ["PRIVATE-a"], parent: "PRIVATE-a" },
      ] }));
    for (const format of ["json", "html"]) {
      const output = join(scratch, `redacted.${format}`);
      const child = Bun.spawnSync([process.execPath, "src/cli.ts", "render", "--snapshot", input, "--redact", "--format", format, "--out", output]);
      expect(child.exitCode).toBe(0);
      const text = readFileSync(output, "utf8");
      expect(text).not.toContain("PRIVATE-"); expect(text).not.toContain("2026-09-30T12:00:00Z");
      if (format === "json") {
        await assertStructure(text);
      }
    }
    const full = Bun.spawnSync([process.execPath, "src/cli.ts", "sync", "--snapshot", input]);
    expect(full.exitCode).toBe(0); expect(full.stdout.toString()).toContain("PRIVATE-description");
    const reduced = Bun.spawnSync([process.execPath, "src/cli.ts", "sync", "--snapshot", input, "--redact"]);
    expect(reduced.exitCode).toBe(0); expect(reduced.stdout.toString()).not.toContain("PRIVATE-");
    const refused = Bun.spawnSync([process.execPath, "src/cli.ts", "serve", "--snapshot", input, "--redact"]);
    expect(refused.exitCode).toBe(2); expect(refused.stderr.toString()).toContain("supported only by sync and render");
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}, 2000);

async function assertStructure(text: string): Promise<void> {
  const repo = new JsonSnapshotRepositoryAdapter(text, "redacted"); const tasks = await repo.load();
  expect(tasks).toHaveLength(2);
  const [first, second] = tasks;
  if (first === undefined || second === undefined) { throw new Error("Missing redacted tasks"); } expect(repo.account).toBeUndefined(); expect(repo.capturedAt).toBeNull();
  expect(second.blockedBy).toEqual([first.id]); expect(second.parent).toBe(first.id);
  expect(first.children).toEqual([second.id]);
  expect(first.effort).toBeUndefined(); expect(first.priority).toBeUndefined(); expect(first.due).toBeUndefined();
  expect(first.status).toBe("open");
  expect(first.blockedBy).toHaveLength(1); expect(first.blockedBy[0]).not.toBe(second.id);
}
