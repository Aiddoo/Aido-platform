import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { WeatherForecastBadge } from '@src/features/weather/presentations/components/WeatherForecastBadge';
import { HStack, ScreenTitleBar } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function FeedLayout() {
  const headerBg = useResolveClassNames('bg-white');
  const stackBg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        header: (props) => <ScreenTitleBar.StackHeader {...props} />,
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        contentStyle: { backgroundColor: stackBg.backgroundColor as string },
        headerLeft: () => (
          <HStack align="center" pl={4}>
            <WeatherForecastBadge />
          </HStack>
        ),
        headerRight: () => (
          <HStack align="center">
            <NotificationBell.Header />
          </HStack>
        ),
      }}
    >
      <Stack.Screen
        name="(feed)"
        options={{ contentStyle: { backgroundColor: headerBg.backgroundColor as string } }}
      />
    </Stack>
  );
}
