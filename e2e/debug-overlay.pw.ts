import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { viewerPage } from "../src/viewer/ViewerPage.ts";
import { SetupData } from "../src/viewer/SetupData.ts";
const dev = pathToFileURL(resolve("dist/debug-development.html")).href;
const normal = pathToFileURL(resolve("dist/debug-normal.html")).href;
test.beforeAll(() => {
  mkdirSync("dist", { recursive: true });
  const data = new SetupData().render({ kind: "setup", reason: "missing", keyTarget: "EXAMPLE_KEY" });
  // The server grants development mode in its shell, never through project JSON or a URL parameter.
  writeFileSync("dist/debug-development.html", viewerPage(data).replace('<html lang="en">', '<html lang="en" data-development="true">'));
  writeFileSync("dist/debug-normal.html", viewerPage(data));
});
test("debug overlay is absent by default and cannot be enabled by a URL or saved rig preference", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("yalikedags.puppy-debug.v1", "bones"); });
  await page.goto(`${normal  }?debug=1`);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("region", { name: "Developer tools" })).toHaveCount(0);
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  await expect(page.getByLabel("Puppy rig debug", { exact: true })).toHaveCount(0);
});
test("development toolbar drags, stays on screen, and hosts rig widgets and diagnostics", async ({ page }) => {
  await page.goto(dev);
  const panel = page.getByRole("region", { name: "Developer tools" });
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Diagnostics output")).toHaveValue(/Developer tools ready/);
  const grip = page.getByRole("button", { name: "Move debug panel" });
  const before = await panel.boundingBox(); const handle = await grip.boundingBox();
  if (before === null || handle === null) { throw new Error("Missing debug panel"); }
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down(); await page.mouse.move(350, 200, { steps: 12 }); await page.mouse.up();
  const after = await panel.boundingBox();
  expect(Math.abs((after?.x ?? 0) - before.x)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("bones");
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("sit");
  await expect(page.getByLabel("Diagnostics output")).toHaveValue(/Puppy action: sit/);
  await page.setViewportSize({ width: 390, height: 640 });
  await expect.poll(() => panel.evaluate(el => {
    const r = el.getBoundingClientRect(); return r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  })).toBe(true);
  await grip.focus(); await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Collapse debug panel" }).click();
  await expect(page.getByLabel("Diagnostics output")).toBeHidden();
  await page.getByRole("button", { name: "Expand debug panel" }).click();
  await expect(page.getByLabel("Diagnostics output")).toBeVisible();
  await page.getByRole("button", { name: "Clear diagnostics" }).click();
  await expect(page.getByLabel("Diagnostics output")).toHaveValue("");
});

test("colored regions fill nodes and triangulated surfaces follow the animated rig", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("regions");
  const mesh = page.locator(".puppy-rig-mesh");
  await expect(mesh).toBeVisible();
  const colors = await page.locator("#puppy-dag-node-tailTip").evaluate(node => {
    const swatch = document.querySelector('.puppy-rig-legend [data-rig-region="tail"]');
    return { fill: getComputedStyle(node).fill, region: swatch === null ? "" : getComputedStyle(swatch, "::before").backgroundColor };
  });
  expect(colors.fill).toBe(colors.region);
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("sit");
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "509");
  // oracle: each triangle vertex equals its named node position after the pose deforms.
  expect(await mesh.evaluate(group => {
    const svg = group.closest("svg"); if (svg === null) { return false; }
    for (const face of group.querySelectorAll<SVGPolygonElement>("polygon")) {
      const ids = (face.dataset["rigVertices"] ?? "").split(" ");
      if (ids.length !== 3) { return false; }
      for (const [index, id] of ids.entries()) {
        const node = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${id}`);
        const point = face.points.getItem(index);
        if (point.x !== node?.cx.baseVal.value || point.y !== node.cy.baseVal.value) { return false; }
      }
    }
    return true;
  })).toBe(true);
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("off");
  await expect(mesh).toBeHidden();
});

test("bow keeps torso depth, draws the forelegs back, and gives far limbs volume", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("regions");
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("bow");
  // oracle: original coordinates face left; larger elbow x pulls the foreleg toward the body.
  await expect.poll(async () => Number(await page.locator("#puppy-dag-node-frontKnee").getAttribute("cx"))).toBeGreaterThan(490);
  const sizes = await page.locator(".brand-puppy").evaluate(svg => {
    const p = (id: string): {x:number;y:number} => {
      const node = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${id}`);
      return {x: node?.cx.baseVal.value ?? 0, y: node?.cy.baseVal.value ?? 0};
    };
    return { torso: p("belly").y-p("back").y, hind: p("rearHeel").x-p("rearPaw").x,
      farFront: p("farFrontBack").x-p("farFrontKnee").x, farRear: p("farRearHeel").x-p("farRearToe").x };
  });
  expect(sizes.torso).toBeGreaterThan(150);
  expect(sizes.hind).toBeGreaterThan(100);
  expect(sizes.farFront).toBeGreaterThan(50);
  expect(sizes.farRear).toBeGreaterThan(70);
});

test("limb joints retain their bind lengths through held poses", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("bones");
  const measure = async (): Promise<number[]> => page.locator(".brand-puppy").evaluate(svg => {
    const coordinates = new Map<string, {x:number;y:number}>();
    for (const node of svg.querySelectorAll<SVGCircleElement>(".node")) {
      coordinates.set(node.id.replace("puppy-dag-node-", ""), {x:node.cx.baseVal.value,y:node.cy.baseVal.value});
    }
    const lengths: number[] = [];
    for (const [a,b] of [["chest","frontKnee"],["frontKnee","frontAnkle"],["hip","rearKnee"],["rearKnee","rearAnkle"],["shoulder","farFrontKnee"],["farFrontKnee","farFrontHeel"]]) {
      const start=coordinates.get(a ?? ""); const end=coordinates.get(b ?? "");
      if (start !== undefined && end !== undefined) { lengths.push(Math.hypot(end.x-start.x,end.y-start.y)); }
    }
    return lengths;
  });
  const bind = await measure();
  for (const pose of ["sit", "bow"]) {
    await page.getByLabel("Puppy pose", { exact: true }).selectOption(pose);
    await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", pose === "sit" ? "509" : "359");
    const actual = await measure();
    expect(actual).toHaveLength(6);
    for (const [i,length] of actual.entries()) { expect(length).toBeCloseTo(bind[i] ?? 0, 2); }
  }
});

test("far limbs have a closed shoulder bridge and a tapered hock above the paw", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("regions");
  // oracle: the shoulder shares a full edge with the far foreleg, not merely a single vertex.
  await expect(page.locator('polygon[data-rig-vertices="shoulder farFrontKnee farFrontBack"]')).toHaveCount(1);
  await expect(page.locator("#puppy-dag-node-farRearAnkle")).toHaveCount(1);
  const shape = await page.locator(".brand-puppy").evaluate(svg => {
    const p = (id: string): {x:number;y:number} => {
      const n = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${id}`);
      return {x:n?.cx.baseVal.value ?? 0,y:n?.cy.baseVal.value ?? 0};
    };
    return { thigh: p("farRearBack").x-p("farRearKnee").x, shin:p("farRearHock").x-p("farRearAnkle").x,
      notch:p("farRearAnkle").x-p("farRearToe").x, paw:p("farRearPaw").y-p("farRearToe").y };
  });
  expect(shape.shin).toBeGreaterThan(20);
  expect(shape.shin).toBeLessThan(shape.thigh);
  expect(shape.notch).toBeGreaterThan(35);
  expect(shape.paw).toBeGreaterThan(15);
});

test("far foreleg retains a projecting paw in standing, sitting and bowing", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("regions");
  for (const pose of ["stand", "sit", "bow"]) {
    await page.getByLabel("Puppy pose", { exact: true }).selectOption(pose);
    await page.waitForTimeout(2200);
    const paw = await page.locator(".brand-puppy").evaluate(svg => {
      const p = (id: string): {x:number;y:number} => {
        const n = svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${id}`);
        if (n === null) { throw new Error(`Missing paw vertex: ${id}`); }
        return { x:n.cx.baseVal.value, y:n.cy.baseVal.value };
      };
      return { depth:p("farFrontPaw").y-p("farFrontToe").y,
        projection:p("farFrontHeel").x-p("farFrontToe").x };
    });
    expect(paw.depth).toBeGreaterThanOrEqual(19);
    expect(paw.projection).toBeGreaterThan(30);
  }
});


test("animation controls remain available with rig visualization off", async ({ page }) => {
  await page.goto(dev);
  await page.getByRole("button", { name: "Puppy rig tool", exact: true }).click();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("off");
  await expect(page.getByLabel("Puppy pose", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wag tail", exact: true })).toBeVisible();
  await expect(page.locator(".puppy-rig-legend")).toBeHidden();
  await page.getByLabel("Puppy pose", { exact: true }).selectOption("sit");
  await expect(page.locator("#puppy-dag-node-eye")).toHaveAttribute("cx", "509");
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("bones");
  await expect(page.locator(".puppy-rig-legend")).toBeVisible();
  await page.getByLabel("Puppy rig debug", { exact: true }).selectOption("off");
  await expect(page.getByLabel("Puppy pose", { exact: true })).toHaveValue("sit");
  await expect(page.getByRole("button", { name: "Shake ears", exact: true })).toBeVisible();
});
