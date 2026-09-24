import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";
import { TextReportRendererAdapter } from "../src/adapters/output/TextReportRendererAdapter.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const analysis = new AnalysisService(new FixedClockAdapter("2026-09-23")).analyse(
  [new Task({ id: "a", title: "First", key: "PRO-1", status: "done" }), new Task({ id: "b", title: "Second <b>", key: "PRO-2", blockedBy: ["a"], effort: 3 })],
  "inline",
);

describe("ViewerRequestHandler", () => {
  // oracle: specified. The page is self-contained: inline SVG, inline JSON, inline script, no external request.
  test("GET / returns a self-contained HTML page carrying the SVG and the snapshot", () => {
    const res = new ViewerRequestHandler(() => analysis).handle("/");
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("text/html");
    expect(res.body).toContain("<svg");
    expect(res.body).toContain('"schema": "yalikedags/snapshot/1"');
    expect(res.body).not.toMatch(/src="https?:/);
    expect(res.body).not.toMatch(/href="https?:/);
    expect(res.body).not.toMatch(/@import|fetch\(/);
  });
  test("GET /snapshot.json returns the snapshot as JSON", () => {
    const res = new ViewerRequestHandler(() => analysis).handle("/snapshot.json");
    expect(res.status).toBe(200);
    expect(res.contentType).toBe("application/json");
    expect(JSON.parse(res.body)).toMatchObject({ schema: "yalikedags/snapshot/1" });
  });
  test("GET /graph.svg and /graph.dot return the renderers' output", () => {
    const h = new ViewerRequestHandler(() => analysis);
    expect(h.handle("/graph.svg").body.startsWith("<svg")).toBe(true);
    expect(h.handle("/graph.dot").body.startsWith("digraph")).toBe(true);
  });
  test("an unknown path is 404 and never echoes the path unescaped", () => {
    const res = new ViewerRequestHandler(() => analysis).handle("/<script>");
    expect(res.status).toBe(404);
    expect(res.body).not.toContain("<script>");
  });
  test("titles are escaped inside the page", () => {
    const res = new ViewerRequestHandler(() => analysis).handle("/");
    expect(res.body).not.toContain("Second <b>");
  });
});

describe("TextReportRendererAdapter", () => {
  // oracle: specified. The report names the frontier, workstreams, both critical lengths, and each finding.
  test("reports counts, frontier, critical path lengths and findings in plain text", () => {
    const text = new TextReportRendererAdapter().render(analysis);
    expect(text).toContain("2 tasks");
    expect(text).toContain("PRO-2");
    expect(text).toMatch(/critical path by depth: 1 task/);
    expect(text).toMatch(/by effort: 3/);
    expect(text).toContain("split-candidate");
  });
});

/**
 * The same page the server returns, as a file. These assert the properties
 * that make it worth having: it opens with no process behind it, and it
 * fetches nothing when opened.
 */
describe("HtmlRendererAdapter", () => {
  const page = (): ReturnType<AnalysisService["analyse"]> =>
    new AnalysisService(new FixedClockAdapter("2026-09-23")).analyse(
      [new Task({ id: "a", key: "PRO-1", title: "Root" }), new Task({ id: "b", key: "PRO-2", title: "Next", blockedBy: ["a"] })],
      "linear:Example",
    );

  // oracle: invariant. A page that fetches anything is not an offline page.
  test("is one self-contained document: no external script, style, image or font", () => {
    const html = new HtmlRendererAdapter().render(page());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script[^>]+\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]+\srel=["']?stylesheet/i);
    expect(html).not.toMatch(/<img\b|url\(\s*https?:|@import/i);
  });

  /**
   * The SVG namespace is the one URL in the page that is not a link: it is an
   * identifier, never fetched. Everything else must have come from a card.
   */
  test("its only outbound links are the per-card ones that came from the source data", () => {
    const withUrl = new AnalysisService(new FixedClockAdapter("2026-09-23")).analyse(
      [new Task({ id: "a", key: "PRO-1", title: "Root", url: "https://linear.app/x/issue/PRO-1" })],
      "linear:Example",
    );
    const urls = (html: string): string[] =>
      [...new Set([...html.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]))].filter((u) => u !== "http://www.w3.org/2000/svg");
    expect(urls(new HtmlRendererAdapter().render(page()))).toEqual([]);
    expect(urls(new HtmlRendererAdapter().render(withUrl))).toEqual(["https://linear.app/x/issue/PRO-1"]);
  });

  // oracle: specified. The server and the file are the same page, or one of them rots.
  test("renders byte for byte what the server returns for /", () => {
    const a = page();
    expect(new HtmlRendererAdapter().render(a)).toBe(new ViewerRequestHandler(() => a).handle("/").body);
  });

  test("carries the graph and the snapshot the page needs to work without a server", () => {
    const html = new HtmlRendererAdapter().render(page());
    expect(html).toContain("<svg");
    expect(html).toContain('id="snapshot"');
    expect(html).toContain("PRO-1");
  });

  test("declares itself as HTML, so the viewer server can serve the same object", () => {
    expect(new HtmlRendererAdapter().contentType).toBe("text/html; charset=utf-8");
  });
});
