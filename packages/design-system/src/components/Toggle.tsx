import { Switch, type SwitchProps } from 'react-native';
import { theme } from './theme';

/** Native switch: orange when on, soft gray when off. */
export function Toggle(props: SwitchProps) {
  return (
    <Switch
      trackColor={{ false: '#D9D8DC', true: theme.color.accent.fg }}
      thumbColor={theme.color.bg.nested}
      ios_backgroundColor="#D9D8DC"
      {...props}
    />
  );
}
