import { test, expect } from "bun:test";
import { VIEW_ROUTES } from "../src/viewer/ViewRoutes.ts";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
test("direct page routes serve the viewer shell and unknown paths remain 404", () => {
  const analysis = new AnalysisService({ today: (): string => "2026-01-01" }).analyse([], "Example");
  const handler = new ViewerRequestHandler(() => analysis);
  for (const path of VIEW_ROUTES.values()) { expect(handler.handle(path).status).toBe(200); }
  expect(handler.handle("/not-a-page").status).toBe(404);
});
