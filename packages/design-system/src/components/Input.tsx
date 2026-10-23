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
  /** Fixed text before the value, with a thin line after it ("+91"). */
  prefix?: string | undefined;
  trailing?: ReactNode;
  /** Kept for old call sites: every Soft Glow field is white now. */
  white?: boolean;
  containerClassName?: string;
}

/** Soft Glow field: a white 54 pill with a soft shadow and an orange ring while focused. */
export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input(
  {
    label,
    helper,
    error,
    icon,
    prefix,
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
        <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          boxShadow:
            focused && !error
              ? '0 0 0 4px rgba(240,106,46,0.18), 0 4px 14px rgba(70,40,70,0.06)'
              : '0 4px 14px rgba(70,40,70,0.06)',
        }}
        className={cn(
          'flex-row gap-2.5 px-[18px] border-[1.5px] bg-card-nested',
          multiline
            ? 'min-h-control-lg items-start py-3 rounded-[22px]'
            : 'h-control-lg items-center rounded-full',
          error ? 'border-danger' : 'border-transparent',
          !editable && 'opacity-disabled',
        )}
      >
        {icon ? <Icon name={icon} size={20} color={theme.color.text.secondary} /> : null}
        {prefix ? (
          <Text
            variant="bodyMedium"
            style={{
              paddingRight: 10,
              borderRightWidth: 1,
              borderRightColor: 'rgba(43,42,46,0.12)',
            }}
          >
            {prefix}
          </Text>
        ) : null}
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

export interface TextAreaProps extends Omit<InputProps, 'multiline'> {
  /** Height before the field grows with its text. 96 by default. */
  minHeight?: number;
}

/** Multi-line Input: text starts at the top, the field grows from `minHeight`. */
export const TextArea = forwardRef<ComponentRef<typeof TextInput>, TextAreaProps>(function TextArea(
  { minHeight = 96, style, ...rest },
  ref,
) {
  return (
    <Input ref={ref} {...rest} multiline style={[{ minHeight, textAlignVertical: 'top' }, style]} />
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
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          style={{
            width: 44,
            height: 44,
            marginRight: -12,
            borderRadius: 22,
            backgroundColor: '#F4F3F2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={visible ? 'eyeSlash' : 'eye'} size={19} color={theme.color.text.secondary} />
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
        <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
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
