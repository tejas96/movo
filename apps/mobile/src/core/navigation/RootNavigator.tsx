import { Button, Screen, theme } from '@movo/design-system';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { isWelcomeSeen } from '../../features/auth/welcome-seen';
import { signOut } from '../auth/auth';
import { type SessionStatus, useSessionStore } from '../auth/session.store';
import { useBootstrap } from '../auth/use-bootstrap';
import { useMeContext } from '../tenant/hooks';
import { QueryError } from '../ui/QueryError';
import { screens } from './registry';
import type { ScreenFlags, ScreenGroup } from './routes';
import { Splash, type SplashStage } from './Splash';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function ContextError({ query }: { query: ReturnType<typeof useMeContext> }) {
  const { t } = useTranslation('common');
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <QueryError query={query} />
        <Button
          label={t('actions.signOut')}
          variant="ghost"
          onPress={() => void signOut()}
          className="mt-2"
        />
      </View>
    </Screen>
  );
}

/**
 * Three worlds, one stack: signed out (auth), signed in without a society (join), and the app.
 * React Navigation swaps the screen set when the session or membership changes.
 */
export function RootNavigator() {
  useBootstrap();
  const status = useSessionStore((s) => s.status);
  const ctx = useMeContext(status === 'signedIn');
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);
  // Read once per launch: leaving Welcome marks it seen without pulling the route from under it.
  const [showWelcome] = useState(() => !isWelcomeSeen());

  // The splash stays on top until the session and the society context are known,
  // so the first real screen is already mounted when it fades away.
  const settled = status === 'signedOut' || Boolean(ctx.data) || ctx.isError;
  const stage: SplashStage = status === 'booting' ? 0 : settled ? 2 : 1;
  const hasSociety = Boolean(ctx.data?.memberships.some((m) => m.status === 'ACTIVE'));

  return (
    <View className="flex-1 bg-canvas">
      {!settled ? null : status === 'signedIn' && !ctx.data ? (
        <ContextError query={ctx} />
      ) : (
        <Navigator status={status} hasSociety={hasSociety} showWelcome={showWelcome} />
      )}
      {splashDone ? null : <Splash stage={stage} onDone={hideSplash} />}
    </View>
  );
}

function Navigator({
  status,
  hasSociety,
  showWelcome,
}: {
  status: SessionStatus;
  hasSociety: boolean;
  showWelcome: boolean;
}) {
  const group: ScreenGroup = status === 'signedOut' ? 'auth' : !hasSociety ? 'join' : 'app';
  const flags: ScreenFlags = { showWelcome };
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.color.bg.canvas },
      }}
    >
      <Stack.Group>
        {screens
          .filter((r) => inGroup(r.group, group) && (r.when?.(flags) ?? true))
          .map((r) => (
            <Stack.Screen
              key={r.name}
              name={r.name as keyof RootStackParamList}
              component={r.component}
              options={r.options}
            />
          ))}
      </Stack.Group>
    </Stack.Navigator>
  );
}

function inGroup(entry: ScreenGroup | readonly ScreenGroup[], group: ScreenGroup): boolean {
  return typeof entry === 'string' ? entry === group : entry.includes(group);
}
