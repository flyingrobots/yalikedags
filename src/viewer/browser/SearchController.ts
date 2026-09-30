import { button, element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class SearchController {
  private readonly results = element("search-results");
  private readonly input: HTMLInputElement;

  constructor(private readonly state: ViewerState, private readonly reveal: () => void) {
    const input = element("search");
    if (!(input instanceof HTMLInputElement)) { throw new Error("Missing search input"); }
    this.input = input;
    input.addEventListener("input", () => { this.render(); });
    input.addEventListener("keydown", (event) => { this.key(event); });
    this.results.addEventListener("click", (event) => { this.choose(event); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { this.results.hidden = true; }
    });
    document.addEventListener("click", (event) => {
      if (event.target instanceof Node && !this.results.parentElement?.contains(event.target)) { this.results.hidden = true; }
    });
  }

  private render(): void {
    const matches = this.state.search(this.input.value);
    this.results.replaceChildren();
    this.results.hidden = this.input.value.trim().length === 0;
    for (const task of matches.slice(0, 30)) {
      this.results.append(button(`${task.key} · ${task.title}`, task.id));
    }
    const count = document.createElement("p");
    count.textContent = matches.length > 30 ? `${String(matches.length)} matches; showing the first 30. Refine your search.` : `${String(matches.length)} matching tasks`;
    this.results.append(count);
  }

  private choose(event: MouseEvent): void {
    if (!(event.target instanceof Element)) { return; }
    const id = event.target.closest("[data-task]")?.getAttribute("data-task");
    if (!id) { return; }
    this.state.select(id); this.reveal(); this.results.hidden = true;
    this.input.focus();
  }

  private key(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault(); this.results.querySelector("button")?.focus();
    }
    if (event.key === "Enter") { this.results.querySelector("button")?.click(); }
  }
}
