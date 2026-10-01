/** Motion settings are theme tokens; the OS preference is live, not sampled only at startup. */
export const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
export function motionNumber(token: string): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
  return Number.isFinite(value) ? value : 0;
}
export function motionDuration(token: string): number { return motionPreference.matches ? 0 : motionNumber(token); }
