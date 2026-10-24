import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../icons';
import { Card, Row } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';
import { theme } from './theme';
import { useKeyboardHeight } from './useKeyboardHeight';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Sticky footer, usually one Button. */
  footer?: ReactNode;
}

/** Bottom sheet on a scrim. 28 radius, grabber, gray body so white inputs stand out. */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.color.bg.scrim }}>
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <KeyboardAvoidingView behavior="padding">
          <View
            className="rounded-t-[32px] bg-canvas px-5 pt-3"
            style={[
              {
                paddingBottom: keyboard > 0 ? 16 : Math.max(insets.bottom, 16) + 8,
                maxHeight: 640,
              },
              theme.shadow.sheet,
            ]}
          >
            <View className="mb-4 h-[5px] w-11 self-center rounded-full bg-card-deep" />
            {title ? (
              <Text variant="h3" className="mb-3.5">
                {title}
              </Text>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
            {footer ? <View className="mt-4">{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** `icon` puts a tinted icon circle in front, for menus of places to go. */
  options: readonly { value: T; label: string; hint?: string; icon?: IconName }[];
  value?: T | undefined;
  onSelect: (value: T) => void;
}

/** Pick one: the options as rows in one glass card, an orange tick on the chosen one. */
export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
}: OptionSheetProps<T>) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Card tight>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Row
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              icon={o.icon}
              title={o.label}
              subtitle={o.hint}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              trailing={
                on ? <Icon name="check" size={22} color={theme.color.accent.fg} /> : <View />
              }
            />
          );
        })}
      </Card>
    </Sheet>
  );
}
