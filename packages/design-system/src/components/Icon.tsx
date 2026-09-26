import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import type { IconName, IconNode, IconStyle } from '../icons';
import { iconData } from '../icons/generated/icon-data';
import { theme } from './theme';

export interface IconProps {
  name: IconName;
  /** linear = outline (default). bold = filled. */
  variant?: IconStyle;
  size?: number;
  color?: string;
}

const ATTR: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'fill-opacity': 'fillOpacity',
  'stroke-opacity': 'strokeOpacity',
};

function props(node: IconNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attrs)) out[ATTR[k] ?? k] = v;
  return out;
}

function renderNode(node: IconNode, key: number): ReactElement | null {
  const p = props(node);
  switch (node.tag) {
    case 'path':
      return <Path key={key} {...p} />;
    case 'circle':
      return <Circle key={key} {...p} />;
    case 'rect':
      return <Rect key={key} {...p} />;
    case 'line':
      return <Line key={key} {...p} />;
    case 'polyline':
      return <Polyline key={key} {...p} />;
    case 'polygon':
      return <Polygon key={key} {...p} />;
    case 'ellipse':
      return <Ellipse key={key} {...p} />;
    default:
      return null;
  }
}

/** Iconsax icon. Colors inside the data are `currentColor`, so one `color` prop tints everything. */
export function Icon({
  name,
  variant = 'linear',
  size = 24,
  color = theme.color.icon.primary,
}: IconProps) {
  const nodes = iconData[name][variant];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      {nodes.map((n, i) => renderNode(n, i))}
    </Svg>
  );
}
