import { ErrorCode } from '@aido/errors';
import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { HStack, QueryErrorBoundary, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { formatDate } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Suspense } from 'react';
import { Pressable } from 'react-native';
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
            <QueryErrorBoundary fallback={WeatherForecastBadge.Error}>
              <Suspense fallback={<WeatherForecastBadge.Loading />}>
                <WeatherForecastBadge />
              </Suspense>
            </QueryErrorBoundary>
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

function WeatherForecastBadge() {
  const router = useRouter();
  const [selectedDate] = useFeedDate();
  const date = formatDate(selectedDate);
  const { data: forecast } = useSuspenseQuery(useGetForecastQueryOptions(date));

  const ForecastIcon =
    resolveIconByPrecipitation(forecast.precipitationType) ??
    resolveIconBySky(forecast.skyCondition);

  return (
    <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
      <HStack align="center" gap={6} px={4}>
        <ForecastIcon width={18} height={18} colorClassName="text-gray-7" />

        <Text size="b4" weight="semibold" shade={8}>
          {Math.round(forecast.temperatureMin)}°/{Math.round(forecast.temperatureMax)}°
        </Text>
      </HStack>
    </Pressable>
  );
}

WeatherForecastBadge.Loading = function Loading() {
  return null;
};

WeatherForecastBadge.Error = function ErrorFallback({ error }: { error: unknown }) {
  const router = useRouter();

  if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)) {
    return (
      <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
        <HStack align="center" gap={4}>
          <WeatherClearIcon width={18} height={18} colorClassName="text-gray-6" />
          <Text size="b4" shade={6}>
            날씨 설정
          </Text>
        </HStack>
      </Pressable>
    );
  }

  return null;
};
