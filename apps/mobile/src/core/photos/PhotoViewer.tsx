import { IconSquare } from '@movo/design-system';
import { FlatList, Image, Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-screen photos on black, swipe between them. index null = closed. */
export function PhotoViewer({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={index !== null}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 bg-ink">
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(u) => u}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} resizeMode="contain" style={{ width, height }} />
          )}
        />
        <View className="absolute right-5" style={{ top: insets.top + 12 }}>
          <IconSquare icon="close" variant="linear" tone="white" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
