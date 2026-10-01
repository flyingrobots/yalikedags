import { Pagination } from "./Pagination.ts";

/** Keep task selection and disclosure state while paging existing project markup. */
export class ElementPagination {
  private readonly pagination: Pagination<HTMLElement>;
  constructor(private readonly items: readonly HTMLElement[], label: string, before: Element) {
    this.pagination = new Pagination(label, (visible) => {
      this.items.forEach((item) => { item.hidden = true; });
      visible.forEach((item) => { item.hidden = false; });
    });
    before.before(this.pagination.control);
    this.set(items);
    const panel = before.closest<HTMLElement>(".panel");
    panel?.addEventListener("yalikedags:reveal", () => {
      const id = panel.dataset["revealTask"];
      if (id === undefined) { return; }
      const selector = `[data-id="${CSS.escape(id)}"],[data-task="${CSS.escape(id)}"]`;
      this.pagination.reveal(item => item.matches(selector) || Array.from(item.querySelectorAll<HTMLElement>(selector)).some(child => !child.hidden));
    });
  }
  set(items: readonly HTMLElement[]): void { this.pagination.set(items); }
}

/** Each group retains its heading and total; pages affect only that group's rows. */
export function paginateGroups(root: ParentNode): void {
  for (const list of root.querySelectorAll<HTMLElement>(".finding-group > ul,.change-group > ul,.impact-list > ul")) {
    if (list.dataset["paginated"] === "true") { continue; }
    list.dataset["paginated"] = "true";
    const heading = list.parentElement?.querySelector("summary,h3")?.textContent ?? "Results";
    new ElementPagination([...list.children].filter((item): item is HTMLElement => item instanceof HTMLElement), heading, list);
  }
}
