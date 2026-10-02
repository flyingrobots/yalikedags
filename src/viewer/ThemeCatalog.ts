/** One registry for the picker, preference validation, and theme coverage tests. */
export const THEMES = [
  { id: "graphite", name: "Graphite" },
  { id: "palm", name: "Palm" },
  { id: "tomorrow-eighties", name: "Tomorrow Night Eighties" },
  { id: "solarized", name: "Solarized" },
  { id: "dracula", name: "Dracula" },
  { id: "monokai", name: "Monokai" },
  { id: "gruvbox", name: "Gruvbox" },
  { id: "tokyo-night", name: "Tokyo Night" },
  { id: "monotone", name: "Monotone" },
];

export function themeById(id: unknown): { id: string; name: string } {
  return THEMES.find((theme) => theme.id === id) ?? { id: "graphite", name: "Graphite" };
}
