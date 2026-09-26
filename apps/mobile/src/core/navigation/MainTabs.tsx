import { FloatingTabBar, type TabSpec } from '@movo/design-system';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../../features/home/HomeScreen';
import { MarketScreen } from '../../features/market/MarketScreen';
import { MeScreen } from '../../features/me/MeScreen';
import { MoneyScreen } from '../../features/money/MoneyScreen';
import { SocietyHubScreen } from '../../features/society/SocietyHubScreen';
import { useModuleEnabled } from '../tenant/hooks';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/** Tabs come from the society's enabled modules. Market only exists when marketplace is on. */
export function MainTabs() {
  const { t } = useTranslation('common');
  const market = useModuleEnabled('marketplace');
  const tabs: TabSpec[] = [
    { name: 'Home', icon: 'home', label: t('tabs.home') },
    { name: 'Society', icon: 'society', label: t('tabs.society') },
    { name: 'Money', icon: 'money', label: t('tabs.money') },
    ...(market ? [{ name: 'Market', icon: 'market', label: t('tabs.market') } as TabSpec] : []),
    { name: 'Me', icon: 'me', label: t('tabs.me') },
  ];
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Society" component={SocietyHubScreen} />
      <Tab.Screen name="Money" component={MoneyScreen} />
      {market ? <Tab.Screen name="Market" component={MarketScreen} /> : null}
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
}
