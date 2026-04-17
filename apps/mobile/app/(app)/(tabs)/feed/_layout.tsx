import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { WeatherForecastBadge } from '@src/features/weather/presentations/components/WeatherForecastBadge';
import { useToday } from '@src/shared/hooks/useToday';
import { HStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function FeedLayout() {
  const headerBg = useResolveClassNames('bg-white');
  const stackBg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        contentStyle: { backgroundColor: stackBg.backgroundColor as string },
        headerLeft: () => (
          <HStack align="center" pl={4}>
            <FeedWeatherBadge />
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

function FeedWeatherBadge() {
  const today = useToday();
  return <WeatherForecastBadge date={formatDate(today)} />;
}
