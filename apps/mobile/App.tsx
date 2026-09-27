import { ToastProvider } from '@movo/design-system';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/core/api/query-client';
import { i18n } from './src/core/i18n';
import { navigationRef } from './src/core/navigation/navigation-ref';
import { RootNavigator } from './src/core/navigation/RootNavigator';
import { navigationTheme } from './src/core/navigation/theme';
import { PushBridge } from './src/core/push/PushBridge';

// A deprecation inside a navigation dependency, not our code. The push token line is for Metro only.
LogBox.ignoreLogs(['ImageBackground is deprecated', '[push] token']);

/** Providers only. Screens and routes live in src/core/navigation. */
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ToastProvider>
            <NavigationContainer ref={navigationRef} theme={navigationTheme}>
              <RootNavigator />
              <PushBridge />
            </NavigationContainer>
          </ToastProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
