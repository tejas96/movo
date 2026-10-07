import type { FileRef } from '@movo/contracts';
import { Text } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { fileUri } from '../api/client';
import { PhotoViewer } from './PhotoViewer';

const THUMB = 96;

/** Read-only thumbnails. A tap opens them full screen. Renders nothing when there are none. */
export function PhotoStrip({ photos }: { photos: FileRef[] }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const uris = photos.map((p) => fileUri(p));
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {uris.map((uri, i) => (
          <Pressable
            key={photos[i]?.id ?? uri}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('photo.open', { n: i + 1 })}
            onPress={() => setOpen(i)}
            className="overflow-hidden rounded-md bg-card active:opacity-pressed"
          >
            <Image source={{ uri }} resizeMode="cover" style={{ width: THUMB, height: THUMB }} />
          </Pressable>
        ))}
      </ScrollView>
      <PhotoViewer images={uris} index={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** A titled PhotoStrip for detail screens. Nothing at all when there are no photos. */
export function PhotoSection({
  title,
  photos,
  className,
}: {
  title: string;
  photos: FileRef[];
  className?: string;
}) {
  if (photos.length === 0) return null;
  return (
    <View className={className}>
      <Text variant="h3" className="mb-3">
        {title}
      </Text>
      <PhotoStrip photos={photos} />
    </View>
  );
}
