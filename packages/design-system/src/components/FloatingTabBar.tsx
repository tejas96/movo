import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { LayoutAnimation, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BoldIconName } from '../icons';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export interface TabSpec {
  name: string;
  icon: BoldIconName;
  label: string;
}

/**
 * Glass tab bar, centred above the bottom edge. The open tab is a white pill with an orange
 * filled icon and its name; the others are ink outline icons.
 * Pass it to <Tab.Navigator tabBar={(p) => <FloatingTabBar {...p} tabs={tabs} />} />.
 */
export function FloatingTabBar({
  state,
  navigation,
  tabs,
}: BottomTabBarProps & { tabs: TabSpec[] }) {
  const insets = useSafeAreaInsets();
  const specs = new Map(tabs.map((t) => [t.name, t]));
  const { tabBar } = theme.layout;
  // The white pill grows on the new tab and shrinks on the old one in one eased move.
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
      style={{ bottom: Math.max(insets.bottom, tabBar.bottom) }}
    >
      <View
        className="flex-row items-center rounded-full"
        style={[
          {
            padding: tabBar.padding,
            gap: 4,
            backgroundColor: theme.color.bg.tabBar,
            borderWidth: 1.5,
            borderColor: theme.color.border.glass,
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
            <Press
              key={route.key}
              scaleTo={0.94}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spec.label}
              onPress={onPress}
              className="flex-row items-center justify-center rounded-full"
              style={
                focused
                  ? [
                      {
                        height: tabBar.item,
                        paddingHorizontal: 18,
                        gap: 8,
                        backgroundColor: theme.color.bg.nested,
                      },
                      theme.shadow.lifted,
                    ]
                  : { width: tabBar.item, height: tabBar.item }
              }
            >
              <Icon
                name={spec.icon}
                variant={focused ? 'bold' : 'linear'}
                size={focused ? 20 : 21}
                color={focused ? theme.color.accent.fg : theme.color.icon.inactive}
              />
              {focused ? (
                <Text variant="bodyMedium" className="font-semibold" numberOfLines={1}>
                  {spec.label}
                </Text>
              ) : null}
            </Press>
          );
        })}
      </View>
    </View>
  );
}
