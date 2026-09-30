---
title: "Documentation Product Standard, Reader-Task Edition"
status: Accepted
binding: true
applies_to: README, docs/, CLI help text, viewer help, contributor material
adapted_from: James Ross, "Documentation Product Standard, Reader-Task Edition"
adapted: 2026-09-23
normative_terms: MUST, SHOULD, MAY
---

# Documentation Product Standard

## 1. Purpose

Documentation is a product interface. Its job is to help a particular reader succeed at a particular task, not to prove that a repository contains enough Markdown.

A healthy documentation system helps readers do five different things: **learn** through a guided, successful experience; **accomplish** a real task in their own environment; **look up** exact facts while working; **understand** concepts, mechanisms, and design choices; **change** the implementation safely and verify the result.

These needs require different documents. A page MUST have one primary job. The README MUST NOT be forced to perform all five jobs; it is a landing page and a first-success path, and it routes everywhere else.

The documentation is successful when a new teammate can reach a rendered DAG of a real Linear project in one sitting; an experienced user can run the audit and act on it without reading source; an operator can diagnose "the sync refused" from the message it printed; a contributor can find the owning file, the invariant, and the test that guards it; an agent can retrieve the smallest relevant page; and every public command, option and output field remains complete, current, and mechanically checkable.

Template compliance alone is not evidence of quality.

## 2. Core principles

### 2.1 Organize around reader intent

The primary organization MUST reflect what readers are trying to do: start using the tool; complete a task; look up a fact; understand a concept; troubleshoot a failure; modify the implementation. Source modules and port names MAY appear in contributor documentation, but they SHOULD NOT be the navigation model for user-facing pages.

### 2.2 Separate page types

Tutorials, how-to guides, reference pages, explanations, troubleshooting guides and contributor guides have different obligations. Pages MUST declare or clearly embody one primary page type. Brief cross-links are encouraged; long digressions are not.

### 2.3 Show the product being used

User-facing documentation MUST lead with real use: real commands, representative input and output, terminal captures, a screenshot of the viewer, concrete examples, observable success and failure states. A source-file index is not a substitute for explaining how to use the product.

### 2.4 Explain before indexing implementation

Contributor documentation SHOULD explain the system model (the two stored facts, the derived folds, the ports) before listing files and symbols.

### 2.5 Standardize facts, not essays

Stable templates are for recurring reference shapes: CLI commands, JSON snapshot fields, exit codes, viewer controls. Narrative pages keep editorial freedom.

### 2.6 Generate what machines already know

The CLI's command and option list, the snapshot schema, and the exit-code table SHOULD be generated or coverage-checked from the source that defines them. Human prose concentrates on intent, mental models, workflows, examples, failure interpretation, tradeoffs, and safe change boundaries.

### 2.7 Agent-readable must not mean human-hostile

Structured metadata and stable page ids are required for agents and MUST coexist with useful human documentation.

## 3. Documentation architecture

```text
docs/
  index.md
  tutorials/
  how-to/
  reference/
  explanation/
  troubleshooting/
  contributing/
  standards/
  generated/
  catalog.yaml
```

The layout is a default, not a law; the separation of reader needs is normative. `docs/standards/` holds this document and its siblings and is contributor material.

### 3.1 The README is the landing page

The README is a router, not an encyclopedia. It SHOULD contain: one plain statement of what yalikedags lets the reader do; the audiences; prerequisites that materially affect success (bun, a Linear key in the vault, `dot` if rendering to SVG through GraphViz); a small set of links grouped by reader goal; one representative image; and a clearly separated contributor section. The README's voice is Mickey's; the routing underneath is this section's. It MUST NOT duplicate the linked pages.

## 4. Page types and their obligations

### 4.1 Tutorial

A guided learning experience. It MUST name the skill gained, state prerequisites and starting state, use a known-good path, give actions in a tested order, show expected intermediate and final results, reach a meaningful result early, explain only what the journey needs, and end with what was learned and where to go next. It SHOULD use the bundled fixture project (`examples/`) so it runs offline and can be executed in CI. It MUST NOT begin with architecture or send the learner into source.

```markdown
# See your first DAG
You will ...
## Before you begin
## 1. Load the example project
## 2. Find the frontier
## 3. Open the viewer
## 4. Try one variation
## What you learned
## Next steps
```

### 4.2 How-to guide

Helps a competent reader accomplish a real goal. Titled as a goal beginning with a verb; states the expected result; names blocking prerequisites; gives the shortest safe route with exact commands; describes the important branches; shows how to verify success; links to reference rather than reproducing it.

```markdown
# Audit a Linear project for missing dependencies
Use this when ...
## Prerequisites
## Procedure
## Verify
## Common variations
## Troubleshooting
## Related reference
```

### 4.3 Reference

Accurate, complete, predictable, for readers already working. Exact names, syntax, fields, types, defaults, constraints, and errors; required versus optional versus experimental; examples adjacent to the facts; generated or coverage-checked where the surface is machine-readable.

CLI command template:

```markdown
# `yalikedags <command>`
## Purpose
## Synopsis
## Arguments
## Options
## Environment and configuration
## Output
## Examples
## Exit status and errors
## Related commands
```

Status or error template:

```markdown
# `<error id>`
## Meaning
## When it occurs
## What remains trustworthy
## Recommended response
## Related statuses
```

Viewer page template:

```markdown
# The graph view
## What it shows
## When to use it
## Screen anatomy
## Controls and keybindings
## Selection and focus behaviour
## Loading, empty, success, and error states
## Related workflows
```

### 4.4 Explanation

Forms an accurate mental model. States the question it resolves, defines concepts in context, describes mechanisms and relationships, distinguishes contract from implementation from accident, uses examples and diagrams where they help, links to reference instead of duplicating it. It MUST NOT become a code tour.

```markdown
# How the frontier is derived
## The problem it solves
## Mental model
## Main mechanism
## Important invariants
## Failure and degradation behaviour
## Tradeoffs and alternatives
## Related tasks and reference
```

### 4.5 Troubleshooting guide

Begins with an observable symptom. Fastest discriminating checks first; signals mapped to causes; concrete recovery; what remains trustworthy during partial failure; a verification step; when to escalate and what evidence to collect.

### 4.6 Contributor guide

Helps maintainers change the implementation safely: subsystem purpose and boundaries, architecture and data flow, source ownership, invariants, normal edit paths by change type, affected consumers, focused and full verification commands, links to executable evidence, known gaps. It MUST NOT be the only documentation for a user-facing feature.

## 5. Coverage by capability

| Capability | Audience | Tutorial | How-to | Reference | Explanation | Troubleshooting | Contributor |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CLI (`sync`, `audit`, `render`) | user | required | required | required | recommended | required | required |
| Viewer (`serve`) | user | required | required | required | recommended | required | required |
| Linear adapter | user, contributor | not needed (covered by CLI tutorial) | required (key setup) | required (fields read) | required (what Linear owns) | required | required |
| Graph services | contributor | not needed | not needed | optional | required | not needed | required |
| Snapshot JSON schema | integrator | not needed | optional | required (generated) | optional | not needed | required |

"Not needed" requires a reason, given inline above. It does not require a placeholder page.

## 6. The viewer is a visual product and is shown visually

Documentation for the viewer MUST include enough visual material for a reader to recognize the interface: a screenshot of the graph view with the frontier highlighted and the sidebar open, and one before/after pair for selection. For each major view: how to reach it, what problem it solves, what each region displays, controls and keys, selection and focus behaviour, empty and error states, one representative workflow. Screenshots are regenerated when the viewer changes and MUST contain only the bundled example project, never a real workspace.

## 7. Examples and executable truth

Examples are part of the contract. User-facing examples MUST be valid, use supported behaviour, include enough context to run, show representative output, avoid unexplained placeholders, and identify anything that writes (there is nothing yet; phase 1 is read-only). Examples that use `examples/` SHOULD be executed in CI.

Present commands and output separately, with `bash` for the command and `text` for the output, no prompt characters in copyable blocks, and nondeterministic parts named:

```bash
yalikedags sync --tasklist examples/example-tasklist.txt --out output/example.json
```

```text
loaded 12 tasks from examples/example-tasklist.txt
frontier: 2 ready, 8 blocked, 2 done
wrote output/example.json
```

Label output as exact, representative, or abridged when it matters. Never fabricate output to make an example look complete.

Placeholders: `example-project` or `$PROJECT` in shell; `<project>` only in formal synopsis; secrets as an explicitly fake `lin_api_test_token_example`. Warnings precede any destructive or credential-bearing command.

## 8. Diagrams

Diagrams are editorial tools, not ornaments. Use one when spatial, temporal, relational, stateful, or concurrent behaviour is materially harder in prose. Every nontrivial visual answers a stated reader question, has meaningful labels, sits beside its explanation, has alt text or a textual equivalent, and renders. Visuals MUST NOT rely on colour alone; the viewer's own legend follows the same rule. No diagram quotas. A diagram that restates the table of contents is deleted.

## 9. Writing, style, and accessibility

Write like a competent teammate: direct, precise, approachable. `you` for the reader's actions; the command or component name for the system's. Imperative for procedures. Present tense. No hype, no apology. Reserve MUST, SHOULD, MAY for this document and its siblings; user pages use plain direct language.

Sentence case headings; task-oriented headings for tutorials and how-tos; exact names for reference. Bold for exact visible labels; inline code for commands, options, files, fields, literal values, error ids. Descriptive link text. One canonical term per concept: **frontier** (the ready antichain), **blocker** (an issue in `blockedBy`), **dependent** (the inverse), **workstream** (a connected piece after gatekeepers are cut), **gatekeeper** (an open task with two or more open dependents), **effort** (the exact source estimate). Copy Linear's labels exactly.

Callouts: Note, Important, Caution, Warning, in that order of severity, and not for emphasis. Purposeful overlap across page types is fine. Template voice ("Think of this as ...", "Why this matters ...") is not.

## 10. Machine-readable catalog

`docs/catalog.yaml` lists every page with `id`, `title`, `type`, `capability`, `audiences`, `status`, `path`, `source_paths`, `intents`, `related`. Ids are unique and stable; paths resolve; type and capability use the controlled vocabularies in this document. The catalog is generated or validated by `bun run docs:lint`, not hand-maintained as authority.

## 11. Evidence and contract documentation

A requirement-to-evidence map is required for the snapshot JSON schema, the CLI's exit codes and JSON output, and the read-only guarantee of phase 1. It is optional for tutorials and explanations.

```markdown
| Requirement | Contract claim | Executable evidence | Fixture | Exact oracle | Status |
|---|---|---|---|---|---|
| R-CLI-1 | `sync` exits 3 and writes nothing when Linear refuses the key | `test/cli.test.ts::sync refuses a rejected key without writing` | `RecordingHttpAdapter` returning 401 | exit 3; no file at `--out`; stderr names `linear_unauthorized` | covered |
```

Requirement ids are stable; evidence names the narrowest executable case; oracles name exact values; planned work is not evidence; gaps are marked as gaps.

## 12. Documentation tests

`bun run docs:lint` checks metadata, unique ids, links and anchors, fenced-block languages, heading hierarchy, and that no block contains a real credential. `bun run docs:test` executes the tutorial against `examples/`. Blocking: broken links, missing languages, duplicate ids, failed executable examples, undocumented public commands or options. Advisory: length, sentence complexity, passive voice, screenshot age.

## 13. Change impact

When observable behaviour changes, the affected user documentation, reference, examples, and evidence MUST be current before merge. A contract-bearing change updates the docs, demonstrates they remain accurate, or declares `docs-impact: none` with a rationale in the commit body. Staleness is inferred from invalidation signals (owned source changed, example stopped running, screenshot no longer matches), not calendar age. Deprecated behaviour is labelled with its replacement; removed behaviour is removed from the docs.

## 14. Definition of done

A page is done when its reader and job are clear, it fulfils its type's obligations, its examples are concrete and accurate, its links lead somewhere useful, visuals are present where needed and absent where not, it does not send readers to source for basic usage, deterministic checks pass, and a target reader has exercised it when the change is material.

## 15. Anti-patterns

One README trying to be everything; every page with the same opening table; generic prose that could be pasted into another project; user docs that explain code layout but not use; "read this source file" as troubleshooting; the viewer documented without showing the viewer; mandatory diagrams that restate headings; manually assembled reference that could be generated; a "verified" status with no defined validation; agent metadata as a substitute for readable pages.

## 16. Project-specific extension

| Item | Value |
|---|---|
| Documentation root and publishing | `docs/` as Markdown in the repository; no site generator in phase 1 |
| Capability taxonomy | `cli`, `viewer`, `linear`, `graph`, `snapshot` |
| Page types | `tutorial`, `how-to`, `reference`, `explanation`, `troubleshooting`, `contributing`, `standard` |
| Audiences | `user`, `operator`, `integrator`, `contributor`, `agent` |
| Public-surface coverage sources | the command table in `src/cli.ts`; the snapshot codec in `src/adapters/output/JsonSnapshotAdapter.ts`; the exit-code table in `src/cli/ExitCode.ts` |
| Commands and CI placement | `docs:lint` on every commit via the pre-commit hook and CI; `docs:test` in CI |
| Ownership | one owner, `flyingrobots` |
| Versioning | docs describe the version in `package.json`; CHANGELOG carries user-visible changes |
| Screenshot and sample data | bundled `examples/` only; never a real workspace, never a real key |
| Baseline | this standard applies from the first TypeScript commit; there is no legacy corpus to migrate |

## 17. Adoption sequence for this repo

1. README as landing page in Mickey's voice, routing by reader goal.
2. Tutorial: see your first DAG from the bundled example.
3. How-tos: store the Linear key in the vault; sync a project; audit it; open the viewer.
4. Reference: every CLI command; the snapshot schema; exit codes; viewer controls.
5. Explanation: how the frontier, workstreams and critical path are derived; what Linear owns and what is derived.
6. Troubleshooting: the sync refused; the graph has a cycle; a relation points outside the project.
7. Contributor: ports and adapters map, edit paths, verification.
8. `docs:lint` and `docs:test` gates.
