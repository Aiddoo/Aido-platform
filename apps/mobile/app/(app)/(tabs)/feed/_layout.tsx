import { ErrorCode } from '@aido/errors';
import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { HStack, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { formatDate } from '@src/shared/utils/date';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
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

function WeatherForecastBadge() {
  const router = useRouter();
  const [selectedDate] = useFeedDate();
  const date = formatDate(selectedDate);
  const {
    data: forecast,
    error,
    isPending,
  } = useQuery({
    ...useGetForecastQueryOptions(date),
    placeholderData: keepPreviousData,
  });

  if (isPending && !forecast) {
    return (
      <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
        <WeatherClearIcon width={18} height={18} color="#FFD233" />
      </Pressable>
    );
  }

  if (error) {
    const label = isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902) ? '날씨 설정' : '날씨';

    return (
      <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
        <HStack align="center" gap={4}>
          <WeatherClearIcon width={18} height={18} color="#FFD233" />
          <Text size="b4" shade={6}>
            {label}
          </Text>
        </HStack>
      </Pressable>
    );
  }

  if (!forecast) return null;

  const ForecastIcon =
    resolveIconByPrecipitation(forecast.precipitationType) ??
    resolveIconBySky(forecast.skyCondition);
  const iconColor =
    forecast.precipitationType === 'NONE'
      ? resolveSkyIconColor(forecast.skyCondition, '#8E8E93')
      : '#8E8E93';
  const currentTemp = forecast.currentTemperature;

  return (
    <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
      <HStack align="center" gap={6} px={4}>
        <ForecastIcon width={18} height={18} color={iconColor} />

        <Text size="b4" weight="semibold" shade={8}>
          {currentTemp}°
        </Text>
      </HStack>
    </Pressable>
  );
}
