import { Row, Sheet } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import type { PhotoSource } from './pick';

/** "Take photo" or "Choose from gallery", and "Remove photo" when there is one to remove. */
export function PhotoSourceSheet({
  visible,
  title,
  onClose,
  onPick,
  onRemove,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onPick: (source: PhotoSource) => void;
  onRemove?: (() => void) | undefined;
}) {
  const { t } = useTranslation('common');
  // iOS cannot open the camera or gallery while this sheet is still sliding away.
  const choose = (fn: () => void) => () => {
    onClose();
    setTimeout(fn, Platform.OS === 'ios' ? 450 : 0);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('photo.add')}>
      <View className="gap-2">
        <Row
          onGray
          icon="camera"
          title={t('photo.take')}
          trailing={<View />}
          onPress={choose(() => onPick('camera'))}
        />
        <Row
          onGray
          icon="gallery"
          title={t('photo.choose')}
          trailing={<View />}
          onPress={choose(() => onPick('library'))}
        />
        {onRemove ? (
          <Row
            tone="danger"
            icon="trash"
            title={t('photo.remove')}
            trailing={<View />}
            onPress={choose(onRemove)}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
