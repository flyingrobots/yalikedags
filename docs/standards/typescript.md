---
title: "TypeScript Code Standards"
status: Accepted
binding: true
applies_to: every TypeScript file under src/ and test/
adapted_from: James Ross, "TypeScript Code Standards", 2026-06-17
adapted: 2026-09-23
---

# TypeScript Code Standards

This is the engineering doctrine for yalikedags. It is written under a specific, modern assumption: **this codebase will be read, refactored, and written by both humans and LLM agents.** Human cleverness is expensive. Agent cleverness is destructive. Therefore this system runs on explicit runtime truth, bounded context, deterministic history, and boring infrastructure.

## Rule 0: Runtime truth wins

When the program is running, only one question matters: **what is actually true right now, in memory, under execution?**

Types, tests, docs, and agent-generated assertions are secondary. If they disagree with runtime reality, they are lying.

- **No `any`, `unknown`, or `as`.** The one exception is `unknown` at a raw I/O boundary: the bytes that come back from Linear's GraphQL endpoint, a file read from disk, a JSON snapshot. Those are `unknown` for exactly as long as it takes a codec to turn them into a domain class, and never longer. `as const` on a literal tuple is not a cast and is allowed.
- **Validation happens at the boundary.** Raw bytes become instantiated, invariant-checked domain classes before entering `src/core`. The Linear adapter validates; `Dag` trusts.
- **No TypeScript gymnastics.** If a type signature requires mapped conditional utility types nested three layers deep, an LLM will hallucinate its resolution and a human will fail to review it. Use explicit runtime classes instead.

In this repo: `tsconfig.json` is `strict` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `useUnknownInCatchVariables`; ESLint runs `strictTypeChecked` and refuses `any`, unnecessary assertions, and non-null assertions. A lint rule is a floor, not the rule; the rule is the sentence above it.

## Rule 1: Agentic legibility (context governance)

Agents have finite attention and struggle with spooky action at a distance. The architecture must act as a strict context governor.

- **Locality of behaviour.** If a behaviour is modified, all relevant context must exist within a single file or an explicit, immediately adjacent import.
- **No magical dependency injection.** Dependencies are passed explicitly through constructors. No auto-wiring, no reflection, no global service locators, no module-level singletons that a test cannot replace. If an agent cannot statically trace the injection through ordinary `import` paths, it is banned.
- **Boring naming.** Names describe structural intent, not metaphors. A port is a `Port`, an adapter is an `Adapter`, a service is a `Service`. `TaskRepositoryPort`, `LinearTaskRepositoryAdapter`, `FrontierService`. The Snatch jokes live in the README and nowhere in `src/`.
- **One concept per file.** Enforced strictly. If an agent is tasked with modifying `ClockPort`, it should only need to load `ClockPort.ts`. File names match the exported concept exactly.

## Rule 2: Deterministic architecture

Core domain logic is completely isolated from side effects, ambient state, and host environments.

- **Hexagonal architecture (ports and adapters).** Mandatory. `src/core` knows nothing of the filesystem, the network, Linear, the terminal, or the system clock. `src/core` MUST NOT import from `src/adapters` or `src/cli`; the lint config enforces the boundary.
- **Total portability.** The core must run identically in bun, Node, Deno, or a browser sandbox. The viewer reuses core services in the browser; that is the test of the rule, not a nice-to-have.
- **Determinism by default.** Any reliance on time, randomness, or id generation is injected through a port. Today the ports are `ClockPort` (for "days until due" and "age") and `HttpPort` (for the Linear adapter). Tests inject a fixed clock and an in-memory HTTP fake. Nothing in `src/core` calls `Date.now()`, `Math.random()`, `crypto.randomUUID()` or `fetch`.

## Rule 3: The data model is the domain model

We reject shape-soup: `interface` plus `factory` plus erased types.

- **Classes for domain values.** If a concept has an invariant, it is a `class`. It validates its state in the constructor and is frozen (`Object.freeze(this)` or `readonly` on every field). `Task` has invariants (cannot block itself, effort is 0 to 3) and is therefore a class, not an interface with a `createTask` helper.
- **Methods over switches.** Do not `switch` on external type tags. Behaviour belongs on the instantiated class. A `Task` knows whether it `isDone()`; callers do not compare status strings.
- **Serialization is an adapter's job.** Domain models do not know how to JSON-stringify themselves, emit DOT, or draw SVG. Codecs and renderers live at the boundary in `src/adapters/output`.

## Rule 4: The provenance-native execution loop

All modifications, whether by human keyboard or AI agent, follow the surgical execution loop. We do not normalize sludge, and we do not hide risk behind green CI reruns. A pass after an unexplained failure is evidence of nondeterminism.

1. **RED.** Create the smallest deterministic regression test. Assert observable behaviour, not implementation text. Mocking is banned; use in-memory adapter fakes (`InMemoryTaskRepositoryAdapter`, `FixedClockAdapter`, `RecordingHttpAdapter`).
2. **GREEN.** Implement the smallest architecture-preserving fix.
3. **VERIFY.** Rerun the regression, then `bun run check` (lint, typecheck, full suite).
4. **PROVENANCE.** Make one focused, atomic commit with a `Change-Kind: refactor|feature|bug-fix|behavior-change` trailer.

Commits tell a deterministic history of the system. Do not combine unrelated fixes. Do not squash structural migrations into feature updates. No agent attribution trailers, ever.

The full testing doctrine is [`testing.md`](testing.md), and it is binding.

## Rule 5: The agent context mandate

No automated agent, coding assistant, or LLM-driven process is entitled to the entire monolithic state of the repository. Agents are bounded observers: they get the minimum structurally correct view required to complete their task.

- **Bounded reads.** Where the Graft tooling is available (`safe_read`, `read_range`, `code_show`, `file_outline`), agents use it, and a file over 150 lines or 12 KB is read as an outline first and then by range. Where it is not available, the same bound applies by hand: read the outline (`grep -n "^export\|^  [a-z].*(.*): "` or the file's section comments), then the range you need. Dumping whole files by default is the failure mode this rule exists to stop.
- **Precision lookup.** Find a symbol by its definition, not by brute-forcing `git log -p` or an unbounded grep across history.
- **Receipts.** Every AI-authored commit records in its body what was read and what was run to verify it, so the provenance of the change is inspectable without the session transcript.

Rules 1 and 5 are the same rule from two sides: the code is laid out so that a bounded read is a sufficient read.

## How this repo applies it

| Concern | Where |
|---|---|
| Domain classes | `src/core/domain/*.ts`, one class per file |
| Pure services | `src/core/services/*Service.ts`, constructor-injected ports only |
| Ports | `src/ports/*Port.ts`, one interface per file |
| Adapters | `src/adapters/{input,output,secrets,http,clock}/*Adapter.ts` |
| Composition root | `src/cli.ts` is the only file that wires adapters into services |
| Boundary decoding | `src/adapters/input/*Codec.ts` turn `unknown` into domain classes |
| Enforcement | `bun run check`; `scripts/hooks/pre-commit` and `pre-push` |
