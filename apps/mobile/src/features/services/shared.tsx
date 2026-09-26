import type { Vendor, VendorCategory, VendorCategoryIcon, VendorStatus } from '@movo/contracts';
import { CircleButton, type IconName, Row, StatusPill, type StatusTone } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { i18n } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';

/** Contract icon names map one to one onto design-system icons. The type check keeps them in sync. */
export const CATEGORY_ICON: Record<VendorCategoryIcon, IconName> = {
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

export const STATUS_TONE: Record<VendorStatus, StatusTone> = {
  SUGGESTED: 'info',
  APPROVED: 'success',
  TRIAL: 'warning',
  BLOCKED: 'danger',
};

/** Seeded categories show in the member's language; committee-made ones as typed. */
export function categoryLabel(c: Pick<VendorCategory, 'key' | 'name'>): string {
  if (!c.key) return c.name;
  return i18n.t(`services:category.${c.key}` as 'services:category.plumber', {
    defaultValue: c.name,
  });
}

export function VendorRow({ vendor, showCategory }: { vendor: Vendor; showCategory?: boolean }) {
  const { t } = useTranslation('services');
  const nav = useNav();
  const subtitle = [
    showCategory ? categoryLabel(vendor.category) : null,
    vendor.availability,
    vendor.addedBy.displayName && vendor.status === 'SUGGESTED'
      ? t('detail.addedBy', { name: vendor.addedBy.displayName })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Row
      icon="services"
      title={vendor.name}
      subtitle={subtitle || undefined}
      onPress={() => nav.navigate('VendorDetail', { vendorId: vendor.id })}
      trailing={
        vendor.status === 'APPROVED' ? (
          <CircleButton
            icon="call"
            accessibilityLabel={t('detail.call')}
            onPress={() => void Linking.openURL(`tel:${vendor.phone}`)}
          />
        ) : (
          <StatusPill label={t(`status.${vendor.status}`)} tone={STATUS_TONE[vendor.status]} />
        )
      }
    />
  );
}
