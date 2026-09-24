#!/usr/bin/env bun
/**
 * docs:lint. Deterministic checks only (documentation standard, section 12):
 * relative links resolve, fenced blocks declare a language, heading levels do
 * not skip, catalog ids are unique and catalog paths resolve. Exit 1 on any
 * finding, each printed as path:line: message.
 */
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const findings: string[] = [];
const report = (file: string, line: number, msg: string): void => {
  findings.push(`${file}:${String(line)}: ${msg}`);
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) {
      return [];
    }
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

function checkLinks(file: string, lines: string[]): void {
  const link = /\]\(([^)\s]+)\)/g;
  lines.forEach((text, i) => {
    for (const m of text.matchAll(link)) {
      const target = m[1] ?? "";
      if (/^(https?:|mailto:|#)/.test(target)) {
        continue;
      }
      const path = target.split("#")[0] ?? "";
      if (path.length > 0 && !existsSync(resolve(dirname(file), path))) {
        report(file, i + 1, `broken link ${target}`);
      }
    }
  });
}

function checkFences(file: string, lines: string[]): void {
  let open = false;
  lines.forEach((text, i) => {
    const m = /^\s*```(.*)$/.exec(text);
    if (!m) {
      return;
    }
    if (!open && (m[1] ?? "").trim().length === 0) {
      report(file, i + 1, "fenced block without a language");
    }
    open = !open;
  });
}

function checkHeadings(file: string, lines: string[]): void {
  let level = 0;
  let inFence = false;
  lines.forEach((text, i) => {
    if (/^\s*```/.test(text)) {
      inFence = !inFence;
    }
    const m = /^(#{1,6})\s/.exec(text);
    if (!inFence && m) {
      const n = (m[1] ?? "").length;
      if (level > 0 && n > level + 1) {
        report(file, i + 1, `heading skips from h${String(level)} to h${String(n)}`);
      }
      level = n;
    }
  });
}

/**
 * Pages kept in docs/ that are deliberately not in the catalog. Each needs a
 * reason, because an unexplained exemption is how an orphan doc set starts.
 */
const NOT_CATALOGUED: Record<string, string> = {
  "research.md": "prototype-era research notes, kept for their content; not part of the reader-task doc set",
  "scaling.md": "prototype-era scaling notes, same",
};

/** The catalog can only see the pages it lists, so check the other direction too. */
function checkOrphans(pages: readonly string[], catalog: string): void {
  const file = join(ROOT, "docs", "catalog.yaml");
  for (const page of pages) {
    const relative = page.slice(join(ROOT, "docs").length + 1);
    if (relative.startsWith("standards/") || NOT_CATALOGUED[relative] !== undefined) {
      continue;
    }
    if (!catalog.includes(`path: ${relative}`)) {
      report(file, 1, `docs/${relative} is in no catalog entry and is not exempt`);
    }
  }
}

function checkCatalog(): void {
  const file = join(ROOT, "docs", "catalog.yaml");
  const ids = new Set<string>();
  readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    const id = /\bid:\s*([\w-]+)/.exec(text)?.[1];
    const path = /\bpath:\s*([^,}\s]+)/.exec(text)?.[1];
    if (id !== undefined) {
      if (ids.has(id)) {
        report(file, i + 1, `duplicate id ${id}`);
      }
      ids.add(id);
    }
    if (path !== undefined && !existsSync(join(ROOT, "docs", path))) {
      report(file, i + 1, `catalog path does not exist: ${path}`);
    }
  });
}

const docPages = walk(join(ROOT, "docs"));
for (const file of [join(ROOT, "README.md"), join(ROOT, "examples", "README.md"), ...docPages]) {
  const lines = readFileSync(file, "utf8").split("\n");
  checkLinks(file, lines);
  checkFences(file, lines);
  checkHeadings(file, lines);
}
checkCatalog();
checkOrphans(docPages, readFileSync(join(ROOT, "docs", "catalog.yaml"), "utf8"));
for (const f of findings) {
  process.stderr.write(`${f}\n`);
}
process.stderr.write(findings.length === 0 ? "docs:lint clean\n" : `docs:lint: ${String(findings.length)} finding(s)\n`);
process.exitCode = findings.length === 0 ? 0 : 1;
