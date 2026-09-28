import { writeFileSync } from "node:fs";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";

export function writeFixtures(): void {
  const service = new AnalysisService({ today: (): string => "2026-09-28" });
  const renderer = new HtmlRendererAdapter();
  writeFileSync("dist/viewer-empty.html", renderer.render(service.analyse([], "Empty example")));
  const tasks = [
    new Task({ id: "__proto__", key: "PRO-1", title: 'Unsafe </script><img src="https://example.invalid/x">', url: "javascript:alert(1)" }),
    new Task({ id: "constructor", key: "PRO-2", title: "Dependent", blockedBy: ["__proto__"] }),
  ];
  writeFileSync("dist/viewer-escaping.html", renderer.render(service.analyse(tasks, "Escaping example")));
  const crowded = Array.from({ length: 150 }, (_, i) => new Task({
    id: `task-${String(i)}`, key: `PRO-${String(i + 1)}`, title: `Example task ${String(i + 1)}`,
    blockedBy: i % 10 === 0 ? [] : [`task-${String(i - 1)}`],
  }));
  writeFileSync("dist/viewer-crowded.html", renderer.render(service.analyse(crowded, "Crowded example")));
}
