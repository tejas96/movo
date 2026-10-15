import type { IconNode, IconNodeData, IconStyle } from './types';

/**
 * Attributes every node of a style shares. scripts/build-icons.mjs leaves them out of the
 * generated data and this file puts them back, so both must read this one table.
 */
export const STYLE_DEFAULTS: Record<IconStyle, Readonly<Record<string, string>>> = {
  linear: {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  },
  bold: { fill: 'currentColor' },
};

/** Compact node -> full node with the style defaults applied. */
export function expandNode(data: IconNodeData, style: IconStyle): IconNode {
  const attrs: Record<string, string> = { ...STYLE_DEFAULTS[style] };
  let tag: IconNode['tag'] = 'path';
  if (typeof data === 'string') {
    attrs.d = data;
  } else {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'tag') tag = v as IconNode['tag'];
      else if (v === null) delete attrs[k];
      else attrs[k] = v;
    }
  }
  return { tag, attrs };
}
