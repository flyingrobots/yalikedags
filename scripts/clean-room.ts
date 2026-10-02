#!/usr/bin/env bun
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
