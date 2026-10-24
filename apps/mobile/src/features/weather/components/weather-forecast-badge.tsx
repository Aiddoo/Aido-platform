import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors/api-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/icon/icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useWeatherSession } from '../hooks/weather-session-provider';
import {
  isForecastRequestable,
  useGetForecastQueryOptions,
} from '../queries/get-forecast-query-options';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '../utils/weather-icon';

export function WeatherForecastBadge() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('weather');
  const session = useWeatherSession();
  const {
    data: forecast,
    error,
    isPending,
  } = useQuery({ ...useGetForecastQueryOptions(), enabled: isForecastRequestable(session) });
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
            {temperature != null
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
  return <TextSkeleton size="b4" className="w-8" />;
};
