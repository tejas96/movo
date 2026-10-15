import type { VendorCategoryIcon } from '@movo/contracts';
import type { BoldIconName } from '@movo/design-system';

/** Contract icon names map one to one onto design-system icons. The type check keeps them in sync. */
export const CATEGORY_ICON: Record<VendorCategoryIcon, BoldIconName> = {
  services: 'services',
  water: 'water',
  electricity: 'electricity',
  ac: 'ac',
  paint: 'paint',
  carpentry: 'carpentry',
  tools: 'tools',
  cleaning: 'cleaning',
  pest: 'pest',
  internet: 'internet',
  monitor: 'monitor',
  mobile: 'mobile',
  lift: 'lift',
  security: 'security',
  gas: 'gas',
  laundry: 'laundry',
  truck: 'truck',
  box: 'box',
  flat: 'flat',
  key: 'key',
  cctv: 'cctv',
  lamp: 'lamp',
  health: 'health',
  cup: 'cup',
  bag: 'bag',
  people: 'people',
};
