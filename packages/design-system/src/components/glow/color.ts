/** `#RRGGBB` → `rgba(r, g, b, a)`. Gradients fade to the same colour at 0 alpha, like CSS does. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
