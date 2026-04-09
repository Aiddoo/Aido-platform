import { ErrorCode } from '@aido/errors';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { HStack, QueryErrorBoundary, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Suspense } from 'react';
import { Pressable } from 'react-native';

interface WeatherForecastBadgeProps {
  date: string;
}

export const WeatherForecastBadge = ({ date }: WeatherForecastBadgeProps) => {
  const router = useRouter();
  const { data: forecast } = useSuspenseQuery(useGetForecastQueryOptions(date));

  if (!forecast) return null;

  const ForecastIcon =
    resolveIconByPrecipitation(forecast.precipitationType) ??
    resolveIconBySky(forecast.skyCondition);
  const iconColor =
    forecast.precipitationType === 'NONE'
      ? resolveSkyIconColor(forecast.skyCondition, '#8E8E93')
      : '#8E8E93';

  return (
    <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
      <HStack align="center" gap={6} px={4}>
        <ForecastIcon width={18} height={18} color={iconColor} />
        <Text size="b4" weight="semibold" shade={8}>
          {forecast.currentTemperature}°
        </Text>
      </HStack>
    </Pressable>
  );
};

WeatherForecastBadge.Loading = function Loading() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
      <WeatherClearIcon width={18} height={18} color="#FFD233" />
    </Pressable>
  );
};

WeatherForecastBadge.Header = function Header({ date }: WeatherForecastBadgeProps) {
  const router = useRouter();
  return (
    <QueryErrorBoundary
      fallback={({ error, reset }) => {
        const isLocationNotSet = isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902);
        const label = isLocationNotSet ? '날씨 설정' : '날씨';
        const onPress = isLocationNotSet ? () => router.push('/weather') : reset;

        return (
          <Pressable onPress={onPress} hitSlop={8}>
            <HStack align="center" gap={4}>
              <WeatherClearIcon width={18} height={18} color="#FFD233" />
              <Text size="b4" shade={6}>
                {label}
              </Text>
            </HStack>
          </Pressable>
        );
      }}
    >
      <Suspense fallback={<WeatherForecastBadge.Loading />}>
        <WeatherForecastBadge date={date} />
      </Suspense>
    </QueryErrorBoundary>
  );
};
