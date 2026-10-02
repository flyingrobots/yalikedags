import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ThirdPartyNotices } from "../scripts/offline/ThirdPartyNotices.ts";
import { rejection } from "./fakes/rejection.ts";

// oracle: the locked GSAP package supplies its declaration and copyright in package.json and README, without a license file.
test("[medium] distribution notices preserve GSAP's shipped license declaration and README", async () => {
  const notices = await new ThirdPartyNotices().collect(resolve(import.meta.dir, ".."));
  expect(notices.packages.some(pkg => pkg.name === "gsap")).toBe(true);
  expect(notices.text).toContain("Standard 'no charge' license: https://gsap.com/standard-license.");
  expect(notices.text).toContain("## README.md\n\n# GSAP (GreenSock Animation Platform)");
  expect(notices.text).toContain("Copyright (c) 2008-2026, GreenSock. All rights reserved.");
}, 2000);

// oracle: a README alone is not a license declaration; missing licensing information must still refuse packaging.
test("[medium] distribution notices refuse dependencies without any license declaration", async () => {
  const root = await mkdtemp(join(tmpdir(), "yalikedags-notices-"));
  try {
    const dependency = join(root, "node_modules", "example");
    await mkdir(dependency, { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { example: "1.0.0" } }));
    await writeFile(join(root, "bun.lock"), JSON.stringify(["example@1.0.0"]));
    await writeFile(join(dependency, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
    await writeFile(join(dependency, "README.md"), "Example package documentation.");
    expect((await rejection(new ThirdPartyNotices().collect(root))).message).toBe("Missing dependency license: example");
  } finally { await rm(root, { recursive: true, force: true }); }
}, 2000);
