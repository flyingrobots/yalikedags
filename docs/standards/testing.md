---
title: "Testing Standards"
status: Accepted
binding: true
scope: every automated assertion in this repository
adapted_from: James Ross, "Testing Standards", 2026-08-16 (portable, project-agnostic by design)
adapted: 2026-09-23
---

# Testing Standards

> A language-agnostic standard for tests that outlive the code they verify.

## How yalikedags applies it

The standard below is the doctrine and is reproduced without dilution. This section is the local binding: what the abstract nouns mean in this repository.

| Standard says | Here |
|---|---|
| Runner | `bun test`. `bun run check` is lint, typecheck, then tests, and is what the hooks and CI run. |
| Contract boundaries (Rule 1) | The ports in `src/ports/`, the CLI's exit codes and JSON output, the rendered DOT and SVG, the snapshot JSON schema. Tests enter through those. `src/core` internals are tested only through a service or a domain class's public methods. |
| Doubles (Rule 2) | In-memory adapter fakes in `test/fakes/`: `InMemoryTaskRepositoryAdapter`, `FixedClockAdapter`, `RecordingHttpAdapter`. No mocking library. A fake for the Linear API is verified against a recorded real response fixture in `test/fixtures/linear/` (a contract suite runs against both). |
| Change kind (Rule 3) | Every commit carries `Change-Kind: refactor|feature|bug-fix|behavior-change`. A refactor commit that edits a test is a review finding. |
| Shown able to fail (Rule 4) | New load-bearing assertions are written before the code and seen red; the commit body says so. For bug fixes the red run on the parent commit is mandatory (Rule 12). |
| Generated evidence (Rule 5) | `bun test` has no property-testing library bundled; `fast-check` is the approved dependency when a rule needs it (round-trips of the snapshot codec, layout invariants). Seeds are printed on failure and checked into `test/corpus/` when they find something. |
| Oracle (Rule 6) | Each non-obvious test carries a one-line `// oracle:` comment. Class 5 (snapshot) oracles are allowed only for DOT and SVG output, are minimized, and are re-baselined through a reviewed diff. |
| Seams (Rule 7) | `ClockPort` (fixed epoch in tests), `HttpPort` (recording fake), no `Math.random` anywhere in `src/`. |
| Hermetic (Rule 8) | No test in the default suite touches the network, `$HOME`, the keychain, or a shared temp dir. The viewer server binds port 0 in tests. The `live` tier is the declared exception, below. |
| Size classes (Rule 9) | `small`: pure, in-process, under 50 ms each; most of the default suite. `medium`: spawns the CLI as a subprocess or binds a loopback socket; tagged in the test name with `[medium]` and budgeted at 2 s each. `live`: talks to a real Linear workspace; lives under `test/live/`, is skipped unless `YALIKEDAGS_LIVE` is set, and is budgeted in minutes. `bun test` runs small and medium; `bun run test:live` runs the live tier. |
| Flakes (Rule 10) | A flaky test is skipped the same day with `test.skip` plus an issue link and an expiry date in the comment; never retried. |
| Coverage (Rule 11) | `bun test --coverage` is for reading, never a gate. |
| Known failures (Rule 17) | `test.failing` from bun is the XFAIL pin: it fails when the test starts passing, which is the inverted semantics the rule asks for. Each carries an owner and an expiry in the comment. |
| Deletion (Rule 18) | Deleting a test names the criterion in the commit body. |
| CI (Rule 19) | `.github/workflows/ci.yml` runs `bun run lint`, `bun run docs:lint`, then `bun test`. The live tier does not gate and is not run in CI: it needs a credential and a workspace, and a gate that cannot run on a fork is a gate that teaches people to ignore red. |
| The live tier | Two deviations are declared rather than hidden: it is not hermetic, and it is order-dependent within its file. Both are recorded at the top of `test/live/Live.test.ts` and in [live testing](../contributing/live-testing.md). It is fenced by a credential name of its own (`YALIKEDAGS_LIVE_KEY`, in the keychain or the environment, never `LINEAR_API_KEY`), a sentinel in the project name, and a prefix on every issue title it will touch. Neither deviation may leak into the default suite. |

Everything from here down is the standard as written.

## The frame

A test is an experiment: it manipulates a system under controlled conditions and reads a gauge. A suite is therefore an instrument, and CI is the lab protocol that keeps it honest between readings.

Every test occupies a cell in a two-axis grid, and its strength is roughly the product of its coordinates. The first axis is who supplies the inputs: a human choosing examples, or a machine generating them randomly, coverage-guided, or by simulated schedule. The second is who supplies the expectation, which is to say what the oracle is: an exact value, a stated property, a reference implementation, a formal consistency model, or merely "the process did not crash." An example checked against an exact value explores one point with a strong oracle; a crash fuzzer explores billions of points with the weakest oracle available. Differential testing and deterministic simulation are the rare techniques strong on both axes, which is why the projects with the most extreme reliability requirements converge on them: SQLite's SQL Logic Test runs 7.2 million generated queries against SQLite and PostgreSQL, MySQL, SQL Server, and Oracle and demands identical answers ([SQLite testing docs](https://www.sqlite.org/testing.html)), and Jepsen generates concurrent histories under injected faults and checks them against consistency models, finding lost writes, stale reads, and read skew in mature systems whose own suites were green ([Jepsen analyses](https://jepsen.io/analyses)).

Like every instrument, a suite fails in exactly three ways, and every rule below suppresses one of them. **False confidence**: the gauge reads green while the system is wrong; vacuous assertions, drifted fakes, goldens blessed unread, coverage theatre. This is the worst economy, because the suite is not merely useless; it converts uncertainty into unwarranted certainty. **False alarm**: the gauge reads red while the system is right; brittle interaction tests, structure-mirrored suites, flakes. The cost is not the failed run but the trained response; Google found 84% of its pass-to-fail transitions involved a flaky test ([Where do our flaky tests come from?](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html)), and at that ratio red has stopped meaning anything. **Decay**: readings stay accurate but stop being affordable or believed; the suite slows until nobody runs it, grows until nobody reads it. _Software Engineering at Google_ puts the end state plainly: a bad test suite can be worse than no test suite at all, because tests derive their value from the trust engineers place in them ([ch. 11](https://abseil.io/resources/swe-book/html/ch11.html)).

Hence the meta-rule: **every rule must name the failure it prevents.** A rule that cannot state its failure mode is not a rule; it is a superstition with a lint check. Three sentences hold the rest in one hand: test promises at boundaries, prove every test can fail, control everything a test observes.

## 1. Test at the narrowest boundary that is a contract.

A boundary is a contract when someone outside the change-control of the code depends on it. If nobody outside the module would have to be told about a change, it is not a boundary, and a test pinned to it is a liability.

Ian Cooper's _TDD, Where Did It All Go Wrong_ argues the same point from the architecture side: adopt ports and adapters, and test through the ports; the trigger for a new test is a new behaviour, not a new class or method. He also revives Kent Beck's original meaning of "unit": the test is the unit of isolation, not the class, which is where the habit of mocking every collaborator came from and why it produces brittle suites ([InfoQ recording](https://www.infoq.com/presentations/tdd-original/)). _SWE at Google_ supplies the causal reason the public surface matters: tests via public APIs form explicit contracts, so if such a test breaks an existing user will also break ([ch. 12](https://abseil.io/resources/swe-book/html/ch12.html)). Tests bound to structure instead earn the name Google's engineers give them: change-detector tests, which fail on any change even when behaviour is unchanged ([ch. 13](https://abseil.io/resources/swe-book/html/ch13.html)).

**In practice.** If the codebase has an explicit boundary (a port, a module API, a CLI, an HTTP surface, a wire format, a durable file) that boundary is the test boundary. Reaching past it to assert on an internal is choosing to depend on the thing the boundary exists to hide. Define the boundary socially, not syntactically, because `export` is a compiler notion and will be gamed. Two clauses keep the rule from degenerating in either direction. _Narrowest_: read naively, "test through the port" means "test only at the outermost port," which is how a suite becomes a handful of slow end-to-end tests; the boundary you want is the edge of the module that owns the behaviour. _Promote rather than reach_: if you feel the need to test an internal, that need is a signal the internal wants to be a module with its own narrow API. Conversely, a helper serving one or two callers should not be frozen by direct tests.

**Prevents.** Mockist brittleness and refactoring deadlock; boundary worship and the resulting ice-cream cone; contract-freeze of non-contracts; the accessor added "for tests" that becomes de facto API.

## 2. Assert on outputs, not internals: harvesting universals, enumerating existentials.

"With state testing, you observe the system itself to see what it looks like after invoking it. With interaction testing, you check that the system took an expected sequence of actions on its collaborators." (_SWE at Google_, ch. 12). Interaction tests check _how_ a system arrived at its result when usually you should care only _what_ the result is; the canonical counterexample is the test that verifies `database.put("foobar")` and passes even when a bug deletes the record immediately afterwards.

An artifact, a return value, an exit code, a rendered page, a refusal message, a row in a table. Prefer the thing a user or a downstream system would actually observe. An output is not only a return value: durable writes, emitted messages, authorization denials, released resources, and the absence of a forbidden effect all count.

A useful sharpening: **harvest rather than enumerate.** When asserting a property over an output (every timestamp is pinned, no field leaks a secret, all ids are well-formed) walk the output and check every match, rather than listing the fields you expect to find. A hand-listed field set is blind to the new field, which is exactly where the next bug arrives.

Harvesting has two blind spots the standard names rather than hides. Absence: you cannot walk what is not there, so harvest universals, enumerate existentials. And vacuity: a recursive check that every timestamp is pinned passes gloriously on an output containing none. Every harvested assertion therefore reports a **witness count** ("found 37 timestamp fields; all pinned", never "all found timestamps were pinned"), and harvest predicates are deny-by-default, failing on any unrecognized shape.

**In practice.** Assert semantic projections: parsed records rather than formatting noise, an unordered set where order is unspecified, required fields rather than whole-object equality. Interaction assertions are permitted only where the interaction crosses a contract boundary and _is_ the behaviour (the Linear API is called exactly once per page; no write is issued in read-only mode). Doubles obey the same logic: real implementations first where they are fast, deterministic, and constructible; then fakes owned by the team that owns the real thing and validated by a contract suite running against both ([Fowler on contract tests](https://martinfowler.com/bliki/ContractTest.html)); stubs sparingly; mocks last. An unowned, uncontracted fake is a fork of someone else's semantics that diverges silently.

**Prevents.** Change detectors that fail on refactors and pass on bugs; enumeration blindness to the new leaking field; vacuous universals over empty collections; the drifted fake that manufactures green builds for a broken integration; under-assertion.

## 3. One test per behaviour, not one per function, and every diff declares which of the four kinds of change it is.

"Rather than writing a test for each method, write a test for each behavior." (_SWE at Google_, ch. 12). A method-shaped suite has to change every time methods move. A behaviour-shaped suite only changes when the promises change: "The ideal test is unchanging: after it's written, it never needs to change unless the requirements of the system under test change."

The same chapter enumerates the four kinds of change and which of them should touch tests: pure refactorings should not, new features should not, bug fixes add a test, and only a deliberate behaviour change edits an existing one. This standard promotes it to a **required declaration** on every commit (`Change-Kind:`), checked against the test diff. When a declared refactoring forces test edits, either the change is affecting behaviour, or the tests were not written at an appropriate level of abstraction.

**In practice.** Behaviour is bounded from both sides. Too fine is the method-shaped suite; too coarse is behaviour inflation. Most tests need one "when" and one "then," and needing the word "and" in a name is good evidence you are testing two things ([Keep Tests Focused](https://testing.googleblog.com/2018/06/testing-on-toilet-keep-tests-focused.html)). One behaviour per test is not one assertion per test; several assertions are right when they establish one atomic promise. Name tests as sentences about behaviour, `frontier excludes a task whose blocker is open` rather than `test frontier 2`, because the name is the first and often only token in a failure report.

**Prevents.** Suites rewritten whenever methods move; test edits smuggled into refactorings; behaviour inflation; the table-driven case whose row label cannot identify what broke.

## 4. Every assertion must be shown able to fail.

Break the thing an assertion protects, run it, and require it to go red and to name itself. **An assertion that survives the deletion of its own subject is not a weak test; it is not a test.**

This is mutation testing, and it is not exotic. SQLite runs mutation testing that "verifies every branch makes a difference in output." Google runs it across the monorepo on every code change ([Petrović and Ivanković, ICSE-SEIP 2018](https://research.google/pubs/state-of-mutation-testing-at-google/)). Just et al.'s study of 357 real faults found mutant detection correlated with real-fault detection more strongly than statement coverage did ([FSE 2014](https://homes.cs.washington.edu/~rjust/publ/mutants_real_faults_fse_2014.pdf)).

**In practice.** Two tiers. _Tier 1, universal_: a demonstration per new or materially changed load-bearing assertion, at authoring time, witnessed in review; nearly free. _Tier 2, where blast radius justifies it_: diff-scoped mutation analysis with survivors triaged as a missing test, a weak oracle, or an accepted gap. **Never gate on a mutation score.** Four traps: red for the wrong reason is not evidence; invalidate caches; equivalent mutants are the tax, not findings; unexecuted assertions are the cheapest vacuity mode of all.

**Prevents.** The vacuous test in all its forms; assertions that test the mocking framework; false all-clears from the calibration tool itself; testimony in place of evidence.

## 5. For "nothing changed" claims, use generated evidence, not more examples.

When the promise is _this refactor changed nothing_, or _these two paths agree_, examples are the wrong instrument. **When the promise quantifies over inputs, the test must quantify over inputs.** Four instruments: cross-branch differential ([Wayne](https://www.hillelwayne.com/post/cross-branch-testing/)), independent-implementation differential ([McKeeman](https://www.semanticscholar.org/paper/Differential-Testing-for-Software-McKeeman/fc881e8d0432ea8e4dd5fda4979243cac5e4b9e3)), property testing ([QuickCheck](https://www.cis.upenn.edu/~bcpierce/courses/552-2008/resources/icfp-quickcheck.pdf); [Hypothesis](https://joss.theoj.org/papers/10.21105/joss.01891)), and metamorphic testing ([Wayne](https://www.hillelwayne.com/post/metamorphic-testing/)).

**In practice.** State the quantified claim before choosing a tool, and classify the generated corpus so that "10,000 cases" cannot mean 9,999 empty strings. Seeds are logged outside the test process; shrinking is mandatory; every minimized counterexample is promoted into the permanent corpus. State the two characteristic lies of differential oracles: correlated failure, and bug-for-bug lock-in.

**Prevents.** False confidence in "nothing changed" refactors; example suites that sample the input space three times and call it covered; irreducible counterexamples; lost seeds; frozen bugs.

## 6. Every assertion names its oracle.

Every test declares where its expected value comes from ([Barr, Harman, McMinn, Shahbaz and Yoo, TSE 2015](https://dl.acm.org/doi/10.1109/TSE.2014.2372785)). The hierarchy, strongest first: **(1) Specified**, written from a requirement independently of the implementation; **(2) Derived**, a reference implementation or a standard's worked example; **(3) Invariant or relational**; **(4) Pseudo/differential**, the old version or another engine; **(5) Change detection**, goldens and snapshots where the oracle is "whatever the code does today."

**In practice.** Put a one-line oracle note on any non-obvious test. Class-5 oracles must be labeled and confined to subsystems where nothing better exists, and are governed by Rule 17. A test whose oracle is "the code, obviously" is usually a tautology. When a class-1 test fails the code is wrong; when a class-5 test fails, something _changed_ and a human must adjudicate. A suite that cannot tell you which kind of red it is has no epistemology, only a pass rate.

**Prevents.** The tautological test; oracle laundering; goldens generated from the current build and accepted unread.

## 7. Determinism is constructed, not assumed.

A test may not consult the wall clock, the network, ambient randomness, thread scheduling, or ambient identity unless the harness has explicitly supplied and logged a controlled substitute ([Fowler, Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html)).

**In practice.** Five seams: time (inject a clock, default to a fixed epoch), randomness (inject the generator, fix the seed), scheduling (drive it explicitly; never a bare sleep), environment (no test reads `$HOME`, DNS, locale, or timezone unless the harness set it), identity (ids and temp paths come from a harness-controlled generator). The port is the pattern that makes all five cheap: hermeticity is Rule 1 applied to the operating system.

**Prevents.** The Heisenbug that reproduces only in CI; the suite that is green when re-run; claims of determinism with no recorded seed.

## 8. Hermetic by default: the test controls everything it observes.

A test run's result may depend only on the code under test, its checked-in inputs, and the harness. Tests create what they need in a sandbox they own and destroy it ([SWE at Google ch. 23](https://abseil.io/resources/swe-book/html/ch23.html); [Luo et al., FSE 2014](https://mir.cs.illinois.edu/lamyaa/publications/fse14.pdf)).

**In practice.** Fresh scratch space per test; no ambient network; no shared mutable fixtures (builders with boring defaults and named overrides, [Pryce](http://www.natpryce.com/articles/000714.html)); servers bind port 0 and read back the assignment. Share what is a contract (fixtures, vectors, corpora), not code that merely sets a scene.

**Prevents.** Order-dependent tests; the "works on my machine" class; the Mystery Guest fixture.

## 9. Every test carries a size class with enforced resource ceilings, and every suite has a latency budget.

Small: single process, no network, no database, no filesystem, no threads, no sleeps. Medium: one machine, loopback only. Large: everything else ([Test Sizes](https://testing.googleblog.com/2010/12/test-sizes.html)). Over one week Google measured 0.5% of small tests, 1.6% of medium, 14% of large as flaky.

**In practice.** Enforce sizes with the sandbox, not the style guide. Budget small tests in milliseconds and the small tier in seconds, declared as an SLO. Every behaviour is tested at the smallest size at which it can be honestly expressed, and nothing is tested at two sizes without a reason.

**Prevents.** The monolithic unclassified suite; E2E accretion into the flaky tier.

## 10. Flakiness has a policy: out of the gate the same day, with an owner and an expiry, and never retried into green.

A flaky test is a bug in the test or in the system, never a fact of nature ([Flaky Tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)).

**In practice.** Detection is statistical; quarantine removes the test from the gate, not from the record; an owner and a fix-by date of two to four weeks, after which the entry becomes a fix or a deletion; no retry-to-green at the gate; the flake budget is a number.

**Prevents.** Alert fatigue and the re-run culture; the permanent allow-failure lane; the graveyard quarantine.

## 11. Coverage is an inspection instrument, never an objective.

Coverage is collected and surfaced at review time to answer one question: what did we not exercise? No coverage percentage is a merge gate or a team target ([Inozemtseva and Holmes, ICSE 2014](https://www.cs.ubc.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf); [Fowler](https://martinfowler.com/bliki/TestCoverage.html)). SQLite's 100% MC/DC is a completeness proof over a frozen kernel and SQLite itself says it is probably not cost effective for a typical application.

**In practice.** Diff coverage in review; archaeology; meta-testing (a drop on unchanged source means the suite changed). Coverage tells you where tests are not; mutation tells you whether tests work; never let the first impersonate the second.

**Prevents.** Coverage theatre; the 80%-as-ceiling effect.

## 12. Every bug fix ships with a test observed red on the unfixed code.

SQLite: a bug is not considered fixed until test cases that would exhibit it are added. The red must be observed _on the unfixed code_, not asserted afterwards; a test written after the fix that "would have failed" is a counterfactual claim. This is the one place where ordering, not merely calibration, is mandated.

**In practice.** The failing test in one commit and the fix in the next. The test encodes the correct behaviour at the boundary, never the internal mechanism of this fix. Fix the class, not only the instance. Irreproducible failures convert the obligation into instrumentation and expanded exploration, recorded as a suite deficiency; "too trivial" and "the patch is obvious" are not carve-outs.

**Prevents.** Regressions walking back in through the same hole; folklore in place of suite state.

## 13. Fuzz what parses; property-test what transforms; keep the corpus as a permanent asset.

Every parser, decoder, deserializer, codec and file-format reader that accepts input across a trust boundary is fuzzed continuously ([OSS-Fuzz](https://github.com/google/oss-fuzz)); every total transformation is property-tested for its invariants. In this repo the trust-boundary parsers are the task-list parser, the snapshot JSON codec, and the Linear response codec; the round-trip `decode(encode(snapshot)) == snapshot` is the highest-value ten lines in the codebase.

**Prevents.** The parser as attack surface; the round-trip bug found by the first user with non-ASCII titles; fuzz-infrastructure rot.

## 14. Concurrency is tested by exploring interleavings, never by stress-and-pray.

Concurrent code is tested with systematic interleaving exploration or deterministic simulation ([CHESS](https://www.usenix.org/event/osdi08/tech/full_papers/musuvathi/musuvathi.pdf); [TigerBeetle](https://docs.tigerbeetle.com/single-page/)). This repo has one concurrency surface, the viewer's local server, and it is tested at rung 1: the request handler is a pure function of (request, snapshot) and the server is a thin adapter around it.

**Prevents.** The Heisenbug; the load test cosplaying as correctness evidence.

## 15. Every durability or recovery promise is tested by seeded fault injection.

If the system claims to survive a failed request, a partial page, a malformed response, or a missing snapshot, those faults are injected on a schedule from a seed ([SQLite anomaly testing](https://www.sqlite.org/testing.html)). The `RecordingHttpAdapter` can fail request N and the sync must either complete cleanly or refuse with a named reason and no partial snapshot written.

**Prevents.** The recovery path that has never been executed.

## 16. Performance tests are controlled experiments, not timings.

A performance test states a hypothesis, controls or randomizes its confounders, reports distributions rather than point estimates ([Mytkowicz et al.](https://dl.acm.org/doi/10.1145/1508284.1508275); [Tene](https://qconsf.com/sf2012/dl/qcon-sanfran-2012/slides/GilTene_HowNotToMeasureLatency.pdf)). Layout on a few hundred nodes has no performance test today; if one arrives it compares ratios against a same-run baseline and lives outside the gate.

**Prevents.** Regression blindness; a perf suite that becomes the flakiest thing you own.

## 17. Golden files and snapshots live under re-baseline discipline.

Every golden is minimized to the behaviour it guards, canonicalized, and re-baselined only through reviewed diffs ([Dodds](https://kentcdodds.com/blog/effective-snapshot-testing); [WebKit TestExpectations](https://trac.webkit.org/wiki/TestExpectations)). A bulk "update all snapshots" commit is a defect in the process. Known failures are pinned with inverted semantics (`test.failing`), with an owner, a link, and an expiry.

**Prevents.** Approval fatigue and the nuke-and-record culture; known issues living in folklore.

## 18. Test code is production code, with recorded deletion criteria.

Test code is reviewed as rigorously as production code and optimized for obviousness over abstraction ([SWE at Google ch. 12](https://abseil.io/resources/swe-book/html/ch12.html); [Beck, Test Desiderata](https://medium.com/@kentbeck_7670/test-desiderata-94150638a4b3)). Names are sentences about behaviour; bodies are arrange/act/assert with no conditionals; failures carry their subjects. Deletion criteria are declared in advance and the commit names which one fired.

**Prevents.** The suite as landfill; CI logs that say `expected false to be true` and nothing else.

## 19. CI gates on trustworthy signals, and on nothing else.

Required tests run automatically before integration. A failure blocks, names an owner, and is fixed, reverted, or waived by a time-bounded written risk decision ([Fowler on Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)). **May gate**: the hermetic small and medium suites, green, no retries; lint and typecheck; sanitizer-class failures. **May not gate**: coverage percentages, mutation scores, anything retriable into green.

**Prevents.** Required checks retried into green; unowned failures; a red default branch for days.

## Reviewer checklist, ordered by kill rate

1. Was every new load-bearing assertion demonstrated able to fail, and did the failure name the specific check? (4)
2. Is the oracle statable in one sentence, and if a change detector, is the artifact minimized and the diff readable? (6, 17)
3. If a bug fix: where is the test observed red on the unfixed code? (12)
4. Does the commit declare its change kind, and does the test diff match? (3, 17)
5. Does the test enter through the narrowest contract boundary that owns the behaviour? (1)
6. Do assertions read observable outcomes at that boundary? (2)
7. Do universal assertions harvest with a witness count? (2)
8. Does the name read as a sentence about behaviour, without "and"? (3, 18)
9. Is it hermetic: owned scratch space, no network, no shared fixtures, no hardcoded ports, no sleeps? (8)
10. Are time, randomness, scheduling, environment, and identity reached only through seeded seams? (7)
11. Is the size class declared and honest? (9)
12. If a double replaced a dependency, is it verified against the real implementation by a shared contract suite or a recorded fixture? (2)
13. If touching a skipped test: owner and expiry, or deletion? (10)
14. Is any coverage argument a signal rather than a target? (11)
15. For generated tests: seed logged, shrinking in place, counterexample checked in? (5, 13)
16. Are tests being deleted? Which criterion fired, and where does the displaced risk now live? (18)

## The standard, compressed

1. Test at the narrowest boundary that is a contract; promote internals that need testing to modules.
2. Assert observable outcomes; harvest universals with a witness count, enumerate existentials.
3. One behaviour per test; every diff declares its change kind; only a behaviour change edits an existing expectation.
4. Every load-bearing assertion is shown able to fail; never gate on a mutation score.
5. Equivalence claims are proven by generated evidence with logged seeds and promoted counterexamples.
6. Every assertion names its oracle; change detection is legitimate only when labeled, minimized, and reviewed.
7. Determinism is constructed at seams for time, randomness, scheduling, environment, identity.
8. Hermetic by default; share contracts, not scenes.
9. Size classes with enforced ceilings and latency budgets.
10. Flakes leave the gate the same day with an owner and an expiry, never retried into silence.
11. Coverage is a review signal, never a target.
12. Every bug fix ships a test observed red on the unfixed code.
13. Fuzz what parses, property-test what transforms, keep the corpus.
14. Concurrency is tested by exploring interleavings with recorded schedules.
15. Every durability or recovery promise is tested by seeded fault injection.
16. Performance tests are controlled experiments.
17. Goldens are minimized, canonicalized, and re-baselined only through reviewed diffs; known failures are pinned XFAIL.
18. Test code is production code, deletable only under recorded criteria.
19. CI gates on hermetic suites, calibration evidence, and crash findings; never on coverage percentages, mutation scores, or anything retriable into green.

A good test, in one sentence, is a deterministic, self-contained experiment that fails if and only if a stated promise is broken, and whose failure names the promise. Do not count tests. Account for claims, counterexamples, and blind spots.
