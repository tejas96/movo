/** One SVG element of a 24x24 icon. Colors are always `currentColor`. */
export interface IconNode {
  readonly tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse';
  readonly attrs: Readonly<Record<string, string>>;
}

/** linear = outline (default), bold = filled (active tab, header icons, tiles). */
export type IconStyle = 'linear' | 'bold';
