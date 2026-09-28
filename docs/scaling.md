# Performance and scaling

## What is established

The current application loads a complete project into memory and renders its graph as SVG. It does not use a database, distributed workers, or incremental synchronization. There is no published capacity or latency benchmark, so task-count tiers and speedup estimates would be misleading.

The browser suite exercises a synthetic 150-task graph for search, selection, and a narrow viewport. That is a correctness check, not a performance guarantee.

## Where costs grow

- `Dag.findCycles` uses recursive Tarjan traversal. Very deep chains can exhaust the JavaScript call stack.
- Redundant-edge detection repeatedly computes ancestor closures. Dense graphs cost more than sparse graphs of the same task count.
- Critical-path computation memoizes paths, but copies path arrays as chains grow.
- Layered layout and SVG generation materialize the whole graph. Docking panels does not virtualize graph nodes or grid cards.
- Apply safety projects candidate graphs and compares their cyclic edges. Plans with many additions require multiple checks.
- Linear issue reads paginate the project. Network latency and query limits are separate from local analysis/rendering cost.

## Measure before changing the architecture

Use synthetic graphs with different shapes: a deep chain, many independent tasks, a wide fan-out, and a dense graph. Record vertex and edge counts, runtime version, hardware, elapsed time, peak memory, and browser interaction latency. Separate source loading, analysis, layout, serialization, and browser rendering.

Repeat measurements on the same fixture before and after a proposed optimization. Preserve graph results and deterministic ordering while comparing performance.

If measurements identify a bottleneck, start at that boundary: iterative traversal for deep graphs, indexed layout lookups, cached closures within one immutable analysis, or rendering only visible cards. Adding storage or distributed systems should follow an observed requirement, not a projected task-count tier.

## Related

- [Architecture and safe change guide](contributing/architecture.md)
- [How the derived views are computed](explanation/derived-views.md)
- [The viewer](reference/viewer.md)
