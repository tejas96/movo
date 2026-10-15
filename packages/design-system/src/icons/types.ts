/** One SVG element of a 24x24 icon. Colors are always `currentColor`. */
export interface IconNode {
  readonly tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse';
  readonly attrs: Readonly<Record<string, string>>;
}

/**
 * One node as stored in generated/icon-data.ts: a path's `d`, or the attributes that differ
 * from the style defaults (`tag` when not a path; null = a default attribute that is absent).
 */
export type IconNodeData = string | Readonly<Record<string, string | null>>;

/** linear = outline (default), bold = filled (active tab, header icons, tiles). */
export type IconStyle = 'linear' | 'bold';
