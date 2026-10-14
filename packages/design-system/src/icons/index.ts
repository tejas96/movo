import { expandNode } from './expand';
import { type IconName, iconData } from './generated/icon-data';
import { iconMap } from './icon-map';
import type { IconNode, IconStyle } from './types';

export type { BoldIconName, IconName } from './generated/icon-data';
export type { IconMapName } from './icon-map';
export type { IconNode, IconNodeData, IconStyle } from './types';
export { iconData, iconMap };

export const iconNames = Object.keys(iconData) as readonly IconName[];

const cache = new Map<string, readonly IconNode[]>();

/**
 * SVG nodes for one icon in one style, with the shared attributes put back.
 * The React Native Icon component renders these with react-native-svg.
 */
export function iconNodes(name: IconName, style: IconStyle = 'linear'): readonly IconNode[] {
  const key = `${name}/${style}`;
  let nodes = cache.get(key);
  if (!nodes) {
    const data = iconData[name][style];
    // TypeScript keeps bold slots to BoldIconName; this fallback only guards casts.
    if (!data) console.warn(`Icon "${name}" has no ${style} style. Add it to boldIcons.`);
    nodes = data ? data.map((n) => expandNode(n, style)) : iconNodes(name, 'linear');
    cache.set(key, nodes);
  }
  return nodes;
}

/** Inline SVG markup for web surfaces (design preview, future web admin). */
export function iconSvgMarkup(name: IconName, style: IconStyle = 'linear', size = 24): string {
  const body = iconNodes(name, style)
    .map((n) => {
      const attrs = Object.entries(n.attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${n.tag} ${attrs}/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${body}</svg>`;
}
