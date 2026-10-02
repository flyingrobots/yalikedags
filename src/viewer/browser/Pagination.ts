/** Paginate an already filtered/sorted collection entirely in the browser. */
export class Pagination<T> {
  readonly control = document.createElement("nav");
  private readonly status = document.createElement("span");
  private readonly previous = document.createElement("button");
  private readonly next = document.createElement("button");
  private readonly first = document.createElement("button");
  private readonly last = document.createElement("button");
  private items: readonly T[] = [];
  private page = 0;
  private size = 25;

  constructor(label: string, private readonly display: (items: readonly T[]) => void) {
    this.control.className = "pagination"; this.control.setAttribute("aria-label", `${label} pagination`);
    this.status.setAttribute("role", "status");
    this.bind(this.first, "First", () => 0);
    this.bind(this.previous, "Previous", () => this.page - 1);
    this.bind(this.next, "Next", () => this.page + 1);
    this.bind(this.last, "Last", () => this.pages() - 1);
    const size = document.createElement("select"); size.setAttribute("aria-label", `${label} page size`);
    for (const value of [10, 25, 50, 100]) { size.add(new Option(`${String(value)} per page`, String(value))); }
    size.value = String(this.size);
    size.addEventListener("change", () => {
      this.size = Number(size.value); this.page = 0; this.render();
    });
    this.control.append(this.status, size, this.first, this.previous, this.next, this.last);
  }

  set(items: readonly T[]): void { this.items = items; this.page = 0; this.render(); }

  private pages(): number { return Math.max(1, Math.ceil(this.items.length / this.size)); }

  private bind(button: HTMLButtonElement, label: string, page: () => number): void {
    button.type = "button"; button.textContent = label;
    button.addEventListener("click", () => {
      this.page = Math.max(0, Math.min(this.pages() - 1, page())); this.render();
      this.control.scrollIntoView({ block: "nearest" });
    });
  }

  private render(): void {
    const start = this.page * this.size;
    const end = Math.min(start + this.size, this.items.length);
    this.status.textContent = `${String(this.items.length ? start + 1 : 0)}–${String(end)} of ${String(this.items.length)} · Page ${String(this.page + 1)} of ${String(this.pages())}`;
    this.first.disabled = this.previous.disabled = this.page === 0;
    this.last.disabled = this.next.disabled = this.page >= this.pages() - 1;
    this.control.hidden = this.items.length <= 10;
    this.display(this.items.slice(start, end));
  }
}
