import { ErrorCode } from '@aido/errors';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

interface WeatherForecastBadgeProps {
  date: string;
}

export const WeatherForecastBadge = ({ date }: WeatherForecastBadgeProps) => {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('weather');
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
      <Pressable onPress={() => push('/weather')} hitSlop={8}>
        <WeatherClearIcon width={18} height={18} color="#FFD233" />
      </Pressable>
    );
  }

  if (error) {
    const label =
      isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)
        ? t('badge.setup')
        : t('badge.label');

    return (
      <Pressable onPress={() => push('/weather')} hitSlop={8}>
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

  return (
    <Pressable onPress={() => push('/weather')} hitSlop={8}>
      <HStack align="center" gap={6} px={4}>
        <ForecastIcon width={18} height={18} color={iconColor} />
        <Text size="b4" weight="semibold" shade={8}>
          {forecast.currentTemperature}°
        </Text>
      </HStack>
    </Pressable>
  );
};
