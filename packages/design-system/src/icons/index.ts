import { iconData } from './generated/icon-data';
import { type IconName, iconMap } from './icon-map';
import type { IconNode, IconStyle } from './types';

export type { IconName } from './icon-map';
export type { IconNode, IconStyle } from './types';
export { iconData, iconMap };

export const iconNames = Object.keys(iconMap) as readonly IconName[];

/** SVG nodes for one icon in one style. The React Native Icon component renders these with react-native-svg. */
export function iconNodes(name: IconName, style: IconStyle = 'linear'): readonly IconNode[] {
  return iconData[name][style];
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
