#!/usr/bin/env bun
/**
 * clean-room: refuse any tracked file that carries somebody else's context.
 *
 * This repository is public-shaped. It is written while working inside a
 * private tracker, so the material that leaks is not secrets, which everyone
 * is careful about, but the ordinary furniture of a real project: a card
 * identifier copied into a sample, a client's name in a comment explaining
 * why a default is what it is, a task count pasted from a real audit.
 *
 * Each one is individually harmless and permanent, which is the problem: they
 * are added at the moment somebody is writing docs from what is in front of
 * them, and removed only if somebody later reads the whole repository with
 * this question in mind. So it is a gate rather than a habit.
 *
 * What it refuses, and both were actually found in this repository on
 * 2026-09-23:
 *
 *   - a four-digit-or-longer issue key, which no example needs and no
 *     synthetic fixture produces. Short keys (PRO-1, PRO-123) stay allowed:
 *     they are obviously illustrative and the documentation standard already
 *     names them as the placeholder form.
 *   - a tracker URL carrying a real workspace slug.
 *
 * **Names are deliberately not in this file.** A denylist publishes what it
 * filters: a rule spelling an organisation's name tells every reader of this
 * repository that the author works for them, which is the thing the rule
 * exists to prevent. This one shipped with exactly that defect and is the
 * reason the paragraph is here. So names live in `.clean-room.local`, one
 * term per line, untracked and gitignored. Write yours there once; the check
 * picks it up with no argument. CI runs the structural rules only, which is
 * correct, because CI cannot hold the term either.
 */
import { readFileSync, existsSync } from "node:fs";

interface Rule {
  pattern: RegExp;
  why: string;
}

const STRUCTURAL: Rule[] = [
  { pattern: /\b[A-Z]{2,5}-\d{4,}\b/g, why: "a real-looking issue key; examples use a short one like PRO-1" },
  { pattern: /https:\/\/linear\.app\/(?!x\/|example)[\w-]+\/issue\//g, why: "a tracker URL carrying a real workspace slug" },
];

const LOCAL_TERMS = ".clean-room.local";

/** Local terms, if the person running this has any. Absent is normal and not a failure. */
function localRules(): Rule[] {
  if (!existsSync(LOCAL_TERMS)) {
    return [];
  }
  return readFileSync(LOCAL_TERMS, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((term) => ({ pattern: new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), why: `a term from ${LOCAL_TERMS}` }));
}

const RULES = [...STRUCTURAL, ...localRules()];

/** This file quotes the patterns it refuses, so it cannot check itself. */
const EXEMPT = new Set(["scripts/clean-room.ts", LOCAL_TERMS]);

const tracked = new Bun.$.Shell();
const files = (await tracked`git ls-files`.text()).split("\n").filter((f) => f.length > 0 && !EXEMPT.has(f));

const findings: string[] = [];
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // a binary or unreadable file carries no prose
  }
  const lines = text.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      for (const m of line.matchAll(rule.pattern)) {
        findings.push(`${file}:${String(i + 1)}: ${m[0]} — ${rule.why}`);
      }
    });
  }
}

for (const f of findings) {
  process.stderr.write(`${f}\n`);
}
process.stderr.write(findings.length === 0 ? "clean-room clean\n" : `clean-room: ${String(findings.length)} finding(s); this repository carries no client context\n`);
process.exitCode = findings.length === 0 ? 0 : 1;
