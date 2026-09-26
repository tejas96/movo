import { type ComponentRef, forwardRef, type ReactNode, useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { useRevealFocused } from './keyboard-reveal';
import { Text } from './Text';
import { theme } from './theme';

export interface InputProps extends TextInputProps {
  label?: string;
  helper?: string | undefined;
  error?: string | undefined;
  icon?: IconName;
  trailing?: ReactNode;
  /** White field for use on a gray sheet. */
  white?: boolean;
  containerClassName?: string;
}

/** Gray 56 field, 20 radius, no border until focused. */
export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input(
  {
    label,
    helper,
    error,
    icon,
    trailing,
    white,
    containerClassName,
    onFocus,
    onBlur,
    editable = true,
    multiline,
    style,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const reveal = useRevealFocused();
  return (
    <View className={containerClassName}>
      {label ? (
        <Text variant="label" tone="secondary" className="mb-1.5">
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'flex-row gap-3 rounded-md px-[18px] border-[1.5px]',
          multiline ? 'min-h-control-lg items-start py-3' : 'h-control-lg items-center',
          white ? 'bg-card-nested' : 'bg-card',
          error ? 'border-danger' : focused ? 'border-ink bg-card-nested' : 'border-transparent',
          !editable && 'opacity-disabled',
        )}
      >
        {icon ? <Icon name={icon} size={20} color={theme.color.text.secondary} /> : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={theme.color.text.secondary}
          selectionColor={theme.color.bg.ink}
          className="flex-1 font-sans text-body text-ink py-0"
          multiline={multiline}
          style={[{ fontFamily: 'Poppins', fontWeight: '400', includeFontPadding: false }, style]}
          onFocus={(e) => {
            setFocused(true);
            // When the keyboard is already open, moving to another field needs its own scroll.
            reveal?.();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="micro" tone="danger" className="mt-1.5 font-normal">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="micro" tone="secondary" className="mt-1.5 font-normal">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

export interface PasswordInputProps extends Omit<InputProps, 'secureTextEntry' | 'trailing'> {}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Icon
            name="eye"
            variant={visible ? 'bold' : 'linear'}
            size={20}
            color={theme.color.text.secondary}
          />
        </Pressable>
      }
    />
  );
}

export interface SelectFieldProps {
  label?: string;
  value?: string | undefined;
  placeholder?: string;
  error?: string | undefined;
  onPress: () => void;
  white?: boolean;
  className?: string;
}

/** Looks like an Input, opens a picker on press. */
export function SelectField({
  label,
  value,
  placeholder,
  error,
  onPress,
  white,
  className,
}: SelectFieldProps) {
  return (
    <View className={className}>
      {label ? (
        <Text variant="label" tone="secondary" className="mb-1.5">
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className={cn(
          'h-control-lg flex-row items-center justify-between rounded-md px-[18px] border-[1.5px]',
          white ? 'bg-card-nested' : 'bg-card',
          error ? 'border-danger' : 'border-transparent',
          'active:bg-card-deep',
        )}
      >
        <Text
          variant="body"
          tone={value ? 'primary' : 'secondary'}
          numberOfLines={1}
          className="flex-1"
        >
          {value ?? placeholder ?? ''}
        </Text>
        <Icon name="chevronDown" size={20} color={theme.color.text.secondary} />
      </Pressable>
      {error ? (
        <Text variant="micro" tone="danger" className="mt-1.5 font-normal">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
