import { viewerPage } from "../src/viewer/ViewerPage.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";
import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
const url = pathToFileURL(resolve("dist/viewer-motion.html")).href;
test.beforeEach(async ({ page }) => {
  await page.mouse.move(1400, 950);
  await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.setProperty("--motion-idle-delay", "3600"); document.documentElement.style.setProperty("--motion-gaze-angle", "0"); document.dispatchEvent(new Event("visibilitychange")); }); });
});
test.beforeAll(() => {
  mkdirSync("dist", { recursive: true });
  const tasks = Array.from({ length: 60 }, (_, i) => new Task({ id: `task-${String(i)}`, title: `Task ${String(i).padStart(2, "0")}` }));
  writeFileSync("dist/viewer-motion-dev.html", viewerPage(new ViewerData().render(new AnalysisService({ today: (): string => "2026-09-30" }).analyse(tasks, "Motion example")), true));
  writeFileSync("dist/viewer-motion.html", new HtmlRendererAdapter().render(new AnalysisService({ today: (): string => "2026-09-30" }).analyse(tasks, "Motion example")));
});

test("offline mascot hover and click animate, theme transitions settle back to CSS tokens", async ({ page }) => {
  const remote: string[] = []; page.on("request", r => { if (/^https?:/.test(r.url())) { remote.push(r.url()); } });
  await page.goto(url);
  const nose = page.locator(".brand-puppy .nose");
  await nose.hover();
  await expect(page.locator(".brand-puppy .dag-motion-node[transform]").first()).toBeAttached();
  await page.locator(".brand-puppy").click({ position: { x: 40, y: 40 } });
  await expect(page.locator(".brand-puppy .dag-energy-wave")).toBeAttached();
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  await page.getByLabel("Display mode", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-transition", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "true");
  expect(await page.locator("html").evaluate(e => e.style.getPropertyValue("--accent"))).toBe("");
  await expect(page.locator(".dag-energy-wave")).toHaveCount(0);
  await expect(page.locator(".dag-motion-node[transform]")).toHaveCount(0);
  expect(remote).toEqual([]);
});

test("reduced motion skips energy and hover motion while theme switching still works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(url);
  await page.locator(".brand-puppy .nose").hover();
  await page.locator(".brand-puppy").click({ position: { x: 40, y: 40 } });
  await expect(page.locator(".dag-energy-wave,.dag-motion-node[transform]")).toHaveCount(0);
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  await page.getByLabel("Display mode", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "true");
});

test("selection follows across paginated views and the inspector defaults to its maximum", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(url);
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("navigation", { name: "Tasks pagination" }).getByRole("button", { name: "Last", exact: true }).click();
  await page.locator('#task-table tr[data-id="task-59"]').click();
  const separator = page.getByRole("separator", { name: "Resize task details" });
  await expect(separator).toHaveAttribute("aria-valuenow", await separator.getAttribute("aria-valuemax") ?? "");
  await separator.focus(); await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Start here", exact: true }).click();
  await expect(page.locator('#frontier [data-id="task-59"]')).toBeInViewport();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator('#task-table tr[data-id="task-59"]')).toBeInViewport();
  await page.reload();
  await page.locator('#task-table tr[data-id="task-0"]').click();
  await expect(separator).toHaveAttribute("aria-valuenow", "280");
});

test("graph pulses grow from the pointer, survive scene replacement, and never fire after a pan", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  const svg = page.locator("#graph > svg");
  await svg.click({ position: { x: 10, y: 10 } });
  const ring = svg.locator(".dag-energy-wave");
  await expect(ring).toBeAttached();
  const first = Number(await ring.getAttribute("r"));
  await expect.poll(async () => Number(await ring.getAttribute("r"))).toBeGreaterThan(first);
  const box = await svg.boundingBox(); if (box === null) { throw new Error("Missing graph"); }
  await page.mouse.move(box.x + 15, box.y + 15); await page.mouse.down();
  await page.mouse.move(box.x + 85, box.y + 65, { steps: 6 }); await page.mouse.up();
  await expect(ring).toHaveCount(0);
  await page.getByLabel("Graph state").selectOption("ready");
  await svg.click({ position: { x: 10, y: 10 } });
  await expect(ring).toBeAttached();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ring).toHaveCount(0);
  await expect(svg.locator(".dag-motion-node[transform]")).toHaveCount(0);
});

test("the wave reaches nearby graph nodes before distant ones", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.getByRole("button", { name: "Fit all", exact: true }).click();
  await page.locator("#graph > svg").evaluate(svg => {
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target;
        if (target instanceof SVGElement && target.hasAttribute("transform") && target.dataset["arrival"] === undefined) { target.dataset["arrival"] = String(performance.now()); }
      }
    });
    observer.observe(svg, { subtree: true, attributes: true, attributeFilter: ["transform"] });
  });
  await page.locator("#graph > svg").click({ position: { x: 10, y: 10 } });
  const near = page.locator('#graph [data-id="task-0"] .dag-motion-node');
  const far = page.locator('#graph [data-id="task-11"] .dag-motion-node');
  await expect(near).toHaveAttribute("data-arrival", /\d/);
  await expect(far).toHaveAttribute("data-arrival", /\d/);
  expect(Number(await far.getAttribute("data-arrival")) - Number(await near.getAttribute("data-arrival"))).toBeGreaterThan(30);
  await expect(page.locator("#graph .dag-motion-node[transform]")).toHaveCount(0);
});

test("selection pans the visible DAG and scrolls the selected task into another view", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.locator('#graph [data-id="task-0"]').focus(); await page.keyboard.press("Enter");
  await expect.poll(() => page.locator('#graph [data-id="task-0"]').evaluate(node => {
    const graph = document.getElementById("graph"); if (graph === null) { return Infinity; }
    const a = node.getBoundingClientRect(); const b = graph.getBoundingClientRect();
    return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
  })).toBeLessThan(2);
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("navigation", { name: "Tasks pagination" }).getByRole("button", { name: "Last", exact: true }).click();
  await page.locator('#task-table tr[data-id="task-59"]').click();
  await page.getByRole("button", { name: "Start here", exact: true }).click();
  await expect(page.locator('#frontier [data-id="task-59"]')).toBeInViewport();
  expect(await page.locator("#ready-panel").evaluate(e => e.scrollTop)).toBeGreaterThan(0);
});

test("puppy tail keyframes move connected geometry and restore the resting pose", async ({ page }) => {
  await page.goto(url);
  const tip = page.locator("#puppy-dag-node-tailTip");
  const edge = page.locator('.brand-puppy [data-from="tailEnd"][data-to="tailTip"]');
  const rest = await tip.getAttribute("cx"); const path = await edge.getAttribute("d");
  await page.locator(".brand-puppy").dispatchEvent("pointerenter");
  await expect.poll(() => tip.getAttribute("cx")).not.toBe(rest);
  // oracle: the endpoint follows the moving node; completion restores exact authored geometry.
  await expect.poll(() => edge.getAttribute("d")).not.toBe(path);
  await expect(tip).toHaveAttribute("cx", rest ?? "");
  await expect(edge).toHaveAttribute("d", path ?? "");
  await page.locator(".brand-puppy").dispatchEvent("pointerenter");
  await expect.poll(() => tip.getAttribute("cx")).not.toBe(rest);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(tip).toHaveAttribute("cx", rest ?? "");
  await expect(edge).toHaveAttribute("d", path ?? "");
  await page.locator(".brand-puppy").dispatchEvent("pointerenter");
  await expect(tip).toHaveAttribute("cx", rest ?? "");
});

test("the sit sequence sits its haunches, holds the pose, and stands back up", async ({ page }) => {
  await page.goto(url);
  const hip = page.locator("#puppy-dag-node-hip");
  const paw = page.locator("#puppy-dag-node-frontPaw");
  const edge = page.locator('.brand-puppy [data-from="back"][data-to="hip"]');
  const rest = await edge.getAttribute("d");
  await page.evaluate(() => { document.documentElement.dataset["puppyAction"] = "sit-sequence"; document.dispatchEvent(new Event("yalikedags:puppy-action")); });
  // oracle: haunches lower and the front paw lifts before the seated hold; all geometry returns to the authored pose.
  await expect.poll(async () => Number(await paw.getAttribute("cy"))).toBeLessThan(650);
  await expect.poll(async () => Number(await hip.getAttribute("cy"))).toBeGreaterThan(450);
  await expect(paw).toHaveAttribute("cy", "657");
  await expect(edge).not.toHaveAttribute("d", rest ?? "");
  await expect(hip).toHaveAttribute("cy", "357", { timeout: 7000 });
  await expect(edge).toHaveAttribute("d", rest ?? "");
  await page.evaluate(() => { document.documentElement.dataset["puppyAction"] = "sit-sequence"; document.dispatchEvent(new Event("yalikedags:puppy-action")); });
  await expect.poll(async () => Number(await hip.getAttribute("cy"))).toBeGreaterThan(400);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(hip).toHaveAttribute("cy", "357");
  await expect(edge).toHaveAttribute("d", rest ?? "");
});

test("seated puppy brings its head over its forearms and retains rounded haunch volume", async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => { document.documentElement.dataset["puppyAction"] = "sit-sequence"; document.dispatchEvent(new Event("yalikedags:puppy-action")); });
  // oracle: head moves backward over the forelegs, with a substantial vertical hip-to-ground span.
  await expect.poll(() => page.locator("#puppy-dag-node-eye").getAttribute("cx")).toBe("509");
  const pose = await page.locator(".brand-puppy").evaluate(svg => {
    const node = (id: string): { x: number; y: number } => {
      const circle = svg.querySelector(`#puppy-dag-node-${  id}`);
      return { x: Number(circle?.getAttribute("cx")), y: Number(circle?.getAttribute("cy")) };
    };
    const eye = node("eye"); const knee = node("frontKnee");
    const pupil = svg.querySelector(".pupil");
    return { alignment: Math.abs(eye.x - knee.x), volume: node("rearPaw").y - node("hip").y,
      pupilX: Number(pupil?.getAttribute("cx")), eyeX: eye.x };
  });
  expect(pose.alignment).toBeLessThan(75);
  expect(pose.volume).toBeGreaterThan(160);
  expect(Math.abs(pose.pupilX - pose.eyeX)).toBeLessThan(8);
});

test("rapid sit requests blend from the visible pose without a standing reset", async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => { document.documentElement.dataset["puppyAction"] = "sit-sequence"; document.dispatchEvent(new Event("yalikedags:puppy-action")); });
  await expect.poll(() => page.locator("#puppy-dag-node-eye").getAttribute("cx")).toBe("509");
  // oracle: a new click must preserve every visible vertex, edge, pupil and ear in the same frame.
  const samples = await page.locator(".brand-puppy").evaluate(svg => {
    const geometry = (): string[] => Array.from(svg.querySelectorAll(".node,.edge,.pupil,.ear-fill"),
      node => [node.getAttribute("cx"), node.getAttribute("cy"), node.getAttribute("d")].join("|"));
    const before = geometry();
    for (let i = 0; i < 4; i++) { document.documentElement.dataset["puppyAction"] = "sit-sequence"; document.dispatchEvent(new Event("yalikedags:puppy-action")); }
    return { before, after: geometry() };
  });
  expect(samples.after).toEqual(samples.before);
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "279", { timeout: 7000 });
  await expect(page.locator("#puppy-dag-node-hip")).toHaveAttribute("cy", "357");
});

test("posture interruptions preserve geometry between animation callbacks", async ({ page }) => {
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback): number => requestFrame(time => {
      callback(time);
      document.dispatchEvent(new Event("test:animation-update"));
    });
  });
  await page.goto(url);
  // oracle: interrupting between an animation update and its queued paint cannot change the displayed pose synchronously.
  const changed = await page.locator(".brand-puppy").evaluate(svg => new Promise<number>(complete => {
    const geometry = (): string => Array.from(svg.querySelectorAll(".node,.edge,.pupil,.ear-fill"),
      node => [node.getAttribute("cx"), node.getAttribute("cy"), node.getAttribute("d")].join("|")).join("\n");
    const sit = (): void => {
      document.documentElement.dataset["puppyAction"] = "sit-sequence";
      document.dispatchEvent(new Event("yalikedags:puppy-action"));
    };
    let samples = 0; let differences = 0;
    const interrupt = (): void => {
      if (samples >= 8) { return; }
      const before = geometry(); sit();
      if (geometry() !== before) { differences++; }
      samples++;
      if (samples === 8) { document.removeEventListener("test:animation-update", interrupt); complete(differences); }
    };
    document.addEventListener("test:animation-update", interrupt);
    sit();
  }));
  expect(changed).toBe(0);
});

test("rig debug exposes owned regions and attached bones, with independent seated wag and head motion", async ({ page }) => {
  await page.goto(pathToFileURL(resolve("dist/viewer-motion-dev.html")).href);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("bones");
  await expect(page.locator(".puppy-rig-bones")).toBeVisible();
  await expect(page.locator(".brand-puppy .node:not([data-rig-region])")).toHaveCount(0);
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("sit");
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "509");
  const hip = await page.locator("#puppy-dag-node-hip").getAttribute("cy");
  const tail = await page.locator("#puppy-dag-node-tailTip").getAttribute("cx");
  await page.getByRole("button", { name: "Wag tail", exact: true }).click();
  await expect.poll(() => page.locator("#puppy-dag-node-tailTip").getAttribute("cx")).not.toBe(tail);
  await expect(page.locator("#puppy-dag-node-hip")).toHaveAttribute("cy", hip ?? "");
  await page.getByRole("button", { name: "Tilt head", exact: true }).click();
  await expect.poll(() => page.locator("#puppy-dag-node-eye").getAttribute("cx")).not.toBe("509");
  await expect(page.locator("#puppy-dag-node-frontPaw")).toHaveAttribute("cy", "657");
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "509");
  const ear = await page.locator("#puppy-dag-node-earTip").getAttribute("cx");
  await page.getByRole("button", { name: "Shake ears", exact: true }).click();
  await expect.poll(() => page.locator("#puppy-dag-node-earTip").getAttribute("cx")).not.toBe(ear);
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "509");
  const attached = await page.locator(".brand-puppy").evaluate(svg =>
    Array.from(svg.querySelectorAll<SVGLineElement>(".puppy-rig-bone")).every(line => {
      const a = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${line.dataset["rigFrom"] ?? ""}`);
      const b = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${line.dataset["rigTo"] ?? ""}`);
      return a !== null && b !== null && line.x1.baseVal.value === a.cx.baseVal.value &&
        line.y1.baseVal.value === a.cy.baseVal.value && line.x2.baseVal.value === b.cx.baseVal.value && line.y2.baseVal.value === b.cy.baseVal.value;
    }));
  expect(attached).toBe(true);
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("bow");
  await expect.poll(async () => Number(await page.locator("#puppy-dag-node-chest").getAttribute("cy"))).toBeGreaterThan(540);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "279");
  await page.reload();
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await expect(page.getByLabel("Puppy rig debug", { exact: true })).toHaveValue("bones");
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("off");
  await expect(page.locator(".puppy-rig-bones")).toBeHidden();
});

test("shock waves push graph nodes away from either impact direction", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  const node = page.locator('#graph [data-id="task-0"] .dag-motion-node');
  await node.evaluate(visual => {
    new MutationObserver(() => {
      const transform = visual.getAttribute("transform") ?? "";
      const value = Number(/translate\(([-\d.e]+)/.exec(transform)?.[1]);
      if (Math.abs(value) > .01 && visual.getAttribute("data-first-x") === null) { visual.setAttribute("data-first-x", String(value)); }
    }).observe(visual, { attributes: true, attributeFilter: ["transform"] });
  });
  for (const side of [-1, 1]) {
    await node.evaluate(visual => { visual.removeAttribute("data-first-x"); });
    const box = await node.boundingBox(); if (box === null) { throw new Error("Missing node"); }
    await page.locator("#graph > svg").dispatchEvent("click", { clientX: box.x + box.width / 2 + side * 100, clientY: box.y + box.height / 2 });
    await expect(node).toHaveAttribute("data-first-x", /\d/);
    expect(Number(await node.getAttribute("data-first-x")) * side).toBeLessThan(0);
    await expect(page.locator("#graph .dag-motion-node[transform]")).toHaveCount(0);
  }
});
