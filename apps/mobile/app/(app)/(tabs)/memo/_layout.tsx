import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { WeatherForecastBadge } from '@src/features/weather/presentations/components/WeatherForecastBadge';
import { useToday } from '@src/shared/hooks/useToday';
import { HStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const bg = useResolveClassNames('bg-gray-1');
  const headerBg = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg.backgroundColor as string },
        animation: 'fade',
        animationDuration: 200,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: '',
          headerStyle: { backgroundColor: headerBg.backgroundColor as string },
          contentStyle: { backgroundColor: headerBg.backgroundColor as string },
          headerLeft: () => (
            <HStack align="center" pl={4}>
              <MemoWeatherBadge />
            </HStack>
          ),
          headerRight: () => (
            <HStack align="center">
              <NotificationBell.Header />
            </HStack>
          ),
        }}
      />
    </Stack>
  );
}

function MemoWeatherBadge() {
  const today = useToday();
  return <WeatherForecastBadge date={formatDate(today)} />;
}
