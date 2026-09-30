export function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) { throw new Error(`viewer element missing: ${id}`); }
  return found;
}

export function button(label: string, task: string): HTMLButtonElement {
  const out = document.createElement("button");
  out.type = "button";
  out.textContent = label;
  out.dataset["task"] = task;
  return out;
}

/** Adopted pop-out nodes can belong to a different browser realm. */
export function isElement(target: EventTarget | null): target is Element {
  return target !== null && "nodeType" in target && target.nodeType === 1;
}
