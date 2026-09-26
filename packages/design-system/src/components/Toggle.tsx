import { Switch, type SwitchProps } from 'react-native';
import { theme } from './theme';

/** Native switch in MOVO colours. */
export function Toggle(props: SwitchProps) {
  return (
    <Switch
      trackColor={{ false: theme.color.bg.cardDeep, true: theme.color.bg.ink }}
      thumbColor={theme.color.bg.nested}
      ios_backgroundColor={theme.color.bg.cardDeep}
      {...props}
    />
  );
}
