import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import { Text } from './Text';
import { theme } from './theme';

export interface TabSpec {
  name: string;
  icon: IconName;
  label: string;
}

/**
 * Floating pill tab bar. The active tab is a black pill with a filled icon and its label.
 * Pass it to <Tab.Navigator tabBar={(p) => <FloatingTabBar {...p} tabs={tabs} />} />.
 */
export function FloatingTabBar({
  state,
  navigation,
  tabs,
}: BottomTabBarProps & { tabs: TabSpec[] }) {
  const insets = useSafeAreaInsets();
  const specs = new Map(tabs.map((t) => [t.name, t]));
  // The black pill grows on the new tab and shrinks on the old one in one eased move.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on tab change only
  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
  }, [state.index]);
  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center"
      style={{ bottom: Math.max(insets.bottom, theme.layout.tabBar.bottom) }}
    >
      <View
        className="flex-row items-center justify-between rounded-full p-1.5"
        style={[
          {
            height: theme.layout.tabBar.height,
            marginHorizontal: theme.layout.tabBar.inset,
            alignSelf: 'stretch',
            backgroundColor: theme.color.bg.tabBar,
          },
          theme.shadow.tabBar,
        ]}
      >
        {state.routes.map((route, index) => {
          const spec = specs.get(route.name);
          if (!spec) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spec.label}
              onPress={onPress}
              className={
                focused
                  ? 'h-12 flex-row items-center gap-2 rounded-full bg-ink pl-3.5 pr-[18px]'
                  : 'h-12 w-12 items-center justify-center rounded-full'
              }
            >
              <Icon
                name={spec.icon}
                variant={focused ? 'bold' : 'linear'}
                size={focused ? 22 : 24}
                color={focused ? theme.color.icon.onInk : theme.color.icon.inactive}
              />
              {focused ? (
                <Text variant="bodyMedium" tone="inverse">
                  {spec.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
