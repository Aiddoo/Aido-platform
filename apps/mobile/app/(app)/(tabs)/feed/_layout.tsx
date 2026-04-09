import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { WeatherForecastBadge } from '@src/features/weather/presentations/components/WeatherForecastBadge';
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
  const [selectedDate] = useFeedDate();
  return <WeatherForecastBadge.Header date={formatDate(selectedDate)} />;
}
