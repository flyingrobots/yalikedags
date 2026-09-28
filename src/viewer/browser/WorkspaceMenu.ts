import { element } from "./Dom.ts";

/** A disclosure of ordinary buttons, with keyboard navigation and focus restoration. */
export class WorkspaceMenu {
  private readonly toggle = element("workspace-settings");
  private readonly menu = element("workspace-menu");
  private readonly root = element("workspace-controls");

  constructor() {
    this.toggle.addEventListener("click", () => { this.setOpen(this.menu.hidden); });
    this.menu.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button") !== null) { this.close(); }
    });
    this.root.addEventListener("keydown", (event) => { this.key(event); });
    this.root.addEventListener("focusout", (event) => {
      if (event.relatedTarget instanceof Node && !this.root.contains(event.relatedTarget)) { this.setOpen(false); }
    });
    document.addEventListener("click", (event) => {
      if (event.target instanceof Node && !this.root.contains(event.target)) { this.setOpen(false); }
    });
  }

  private setOpen(open: boolean): void {
    this.menu.hidden = !open;
    this.toggle.setAttribute("aria-expanded", String(open));
  }

  private close(): void { this.setOpen(false); this.toggle.focus(); }

  private key(event: KeyboardEvent): void {
    if (event.key === "Escape" && !this.menu.hidden) {
      event.preventDefault(); event.stopPropagation(); this.close(); return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { return; }
    event.preventDefault(); this.setOpen(true);
    const buttons = Array.from(this.menu.querySelectorAll<HTMLButtonElement>("button:not([hidden]):not(:disabled)"));
    const current = buttons.findIndex((button) => button === document.activeElement);
    buttons[this.next(event.key, current, buttons.length)]?.focus();
  }

  private next(key: string, current: number, count: number): number {
    if (key === "Home") { return 0; }
    if (key === "End" || (key === "ArrowUp" && current < 0)) { return count - 1; }
    return (current + (key === "ArrowDown" ? 1 : -1) + count) % count;
  }
}
