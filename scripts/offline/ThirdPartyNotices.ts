import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { rec, str } from "../../src/adapters/linear/GraphqlJson.ts";

/** Collect installed production dependency versions and their shipped license texts. */
export class ThirdPartyNotices {
  async collect(root: string): Promise<{ text: string; packages: { name: string; version: string }[] }> {
    const manifest: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const queue = Object.keys(rec(rec(manifest)["dependencies"]));
    const packages: { name: string; version: string }[] = [];
    const texts: string[] = []; const seen = new Set<string>();
    const lock = await readFile(join(root, "bun.lock"), "utf8");
    for (const name of queue) {
      if (seen.has(name)) { continue; } seen.add(name);
      const directory = join(root, "node_modules", name);
      const raw: unknown = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      const data = rec(raw); const version = str(data["version"]);
      if (version === undefined || !lock.includes(JSON.stringify(`${name}@${version}`))) { throw new Error(`Dependency is not locked: ${name}`); }
      const files = (await readdir(directory)).filter((file) => /^(license|copying|notice)(\.|-|$)/i.test(file)).sort();
      if (!files.length) { throw new Error(`Missing dependency license: ${name}`); }
      packages.push({ name, version }); texts.push(`# ${name} ${version}\n`);
      for (const file of files) { texts.push(`## ${file}\n\n${await readFile(join(directory, file), "utf8")}\n`); }
      queue.push(...Object.keys(rec(data["dependencies"])));
    }
    return { text: texts.join("\n"), packages };
  }
}
