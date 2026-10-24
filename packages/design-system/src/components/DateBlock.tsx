import { View } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

/** 56 x 60 white block with the day and the month, for Upcoming cards. */
export function DateBlock({
  day,
  month,
  white = true,
}: {
  day: string;
  month: string;
  white?: boolean;
}) {
  return (
    <View
      className={
        white
          ? 'h-[60px] w-14 items-center justify-center rounded-[18px] bg-card-nested'
          : 'h-[60px] w-14 items-center justify-center rounded-[18px] bg-card border-[1.5px] border-glass'
      }
      style={white ? theme.shadow.control : undefined}
    >
      <Text variant="h2" className="leading-6">
        {day}
      </Text>
      <Text variant="micro" tone="secondary" className="text-[11px] tracking-wide">
        {month.toUpperCase()}
      </Text>
    </View>
  );
}
