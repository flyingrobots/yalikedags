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
