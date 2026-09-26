import { theme } from '@movo/design-system';
import { DefaultTheme, type Theme } from '@react-navigation/native';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.color.bg.ink,
    background: theme.color.bg.canvas,
    card: theme.color.bg.canvas,
    text: theme.color.text.primary,
    border: theme.color.border.divider,
    notification: theme.color.status.danger.fg,
  },
};
