import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors/api-error';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Pressable } from 'react-native';

import { useWeatherSession } from '../providers/weather-session-provider';
import { useGetForecastQueryOptions } from '../queries/get-forecast-query-options';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from './weather-icon.resolver';

export function WeatherForecastBadge() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('weather');
  const session = useWeatherSession();
  const {
    data: forecast,
    error,
    isPending,
  } = useQuery(useGetForecastQueryOptions(session.clock.date));
  const label =
    session.status === 'unsupported'
      ? t('badge.domesticOnly')
      : isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)
        ? t('badge.setup')
        : t('badge.label');
  const ForecastIcon = forecast
    ? (resolveIconByPrecipitation(forecast.precipitationType) ??
      resolveIconBySky(forecast.skyCondition))
    : WeatherClearIcon;
  const color =
    forecast && forecast.precipitationType === 'NONE'
      ? resolveSkyIconColor(forecast.skyCondition, '#8E8E93')
      : '#FFD233';
  const loading =
    session.status === 'checking' ||
    session.isSyncing ||
    (isPending && session.status !== 'unsupported');
  const temperature = forecast?.currentTemperature;

  return (
    <Pressable
      onPress={() => push('/weather')}
      accessibilityRole="button"
      accessibilityLabel={t('badge.label')}
      style={{ minHeight: 44, minWidth: 64, justifyContent: 'center' }}
      hitSlop={4}
    >
      <HStack align="center" gap={6} px={4}>
        <ForecastIcon width={18} height={18} color={color} />
        {loading ? (
          <WeatherForecastBadge.Loading />
        ) : forecast && session.status !== 'unsupported' ? (
          <Text size="b4" weight="semibold" shade={8}>
            {temperature !== null && temperature !== undefined
              ? `${temperature}°`
              : `${Math.round(forecast.temperatureMin)}°–${Math.round(forecast.temperatureMax)}°`}
          </Text>
        ) : (
          <Text size="b4" shade={6}>
            {label}
          </Text>
        )}
      </HStack>
    </Pressable>
  );
}

WeatherForecastBadge.Loading = function Loading() {
  return <Skeleton className="h-4 w-8 rounded" />;
};
