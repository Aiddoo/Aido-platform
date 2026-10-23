import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors/api-error';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Spacing, Text, VStack, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Skeleton } from 'heroui-native';
import { View } from 'react-native';
import { match, P } from 'ts-pattern';

import { getPrecipitationTypeLabel, getSkyConditionLabel } from '../constants/weather-labels';
import { WeatherPolicy } from '../domains/weather.model';
import { useTimePalette } from '../hooks/use-time-palette';
import { useGetForecastQueryOptions } from '../queries/get-forecast-query-options';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '../utils/weather-icon';
import { WeatherLocationPrompt } from './weather-location-prompt';
import { WeatherMessage } from './weather-message';

export function CurrentWeather() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { data: forecast } = useSuspenseQuery(useGetForecastQueryOptions());
  const showPrecipitation = WeatherPolicy.shouldShowPrecipitation(forecast);
  const ForecastIcon =
    (showPrecipitation && resolveIconByPrecipitation(forecast.precipitationType)) ||
    resolveIconBySky(forecast.skyCondition);
  const forecastIconColor = showPrecipitation
    ? palette.text
    : resolveSkyIconColor(forecast.skyCondition, palette.text);
  const minimum = Math.round(forecast.temperatureMin);
  const maximum = Math.round(forecast.temperatureMax);

  return (
    <>
      <VStack align="center" gap={8}>
        <Text
          className={
            forecast.currentTemperature === null
              ? 'text-[48px] leading-[56px] font-medium'
              : 'text-[80px] leading-[88px] font-medium tracking-[-2.4px]'
          }
          style={{ color: palette.text }}
        >
          {forecast.currentTemperature === null
            ? `${minimum}°–${maximum}°`
            : `${forecast.currentTemperature}°`}
        </Text>

        <HStack gap={4} align="center">
          <Text size="b2" style={{ color: palette.textSub }}>
            {t('screen.tempLow')}
          </Text>
          <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
            {minimum}°
          </Text>
          <Text size="b2" style={{ color: palette.textSub }}>
            {' / '}
            {t('screen.tempHigh')}
          </Text>
          <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
            {maximum}°
          </Text>
        </HStack>

        <HStack gap={8} align="center" className="mt-2">
          <ForecastIcon width={18} height={18} color={forecastIconColor} />
          <Text size="b2" weight="semibold" style={{ color: palette.text }}>
            {showPrecipitation
              ? getPrecipitationTypeLabel(forecast.precipitationType)
              : getSkyConditionLabel(forecast.skyCondition)}
          </Text>
        </HStack>

        {showPrecipitation && (
          <Box px={14} py={5}>
            <Text size="b3" weight="medium" style={{ color: palette.icon }}>
              {getPrecipitationTypeLabel(forecast.precipitationType)}{' '}
              {forecast.precipitationProbability}%
            </Text>
          </Box>
        )}
      </VStack>

      {forecast.currentTemperature === null && (
        <Text size="b4" align="center" style={{ color: palette.textSub }}>
          {t('screen.dailyRange')}
        </Text>
      )}

      <Spacing size={32} />

      <HStack align="center" className="justify-center gap-5">
        <Stat label={t('screen.wind')} value={`${forecast.windSpeed} m/s`} />
        <StatDivider />
        <Stat label={t('screen.humidity')} value={`${forecast.humidity}%`} />
        <StatDivider />
        <Stat label={t('screen.precipProb')} value={`${forecast.precipitationProbability}%`} />
      </HStack>
    </>
  );
}

CurrentWeather.Loading = function Loading() {
  const headerHeight = useHeaderHeight();
  const { glass } = useTimePalette();

  return (
    <VStack align="center" style={{ paddingTop: headerHeight + 24 }}>
      <Skeleton className="h-5 w-20 rounded" style={{ backgroundColor: glass }} />
      <Spacing size={12} />
      <Skeleton className="h-[88px] w-[160px] rounded-xl" style={{ backgroundColor: glass }} />
      <Spacing size={8} />
      <Skeleton className="h-5 w-36 rounded" style={{ backgroundColor: glass }} />
      <Spacing size={32} />
      <HStack align="center" className="justify-center gap-5">
        <Skeleton className="h-12 w-16 rounded" style={{ backgroundColor: glass }} />
        <Skeleton className="h-12 w-16 rounded" style={{ backgroundColor: glass }} />
        <Skeleton className="h-12 w-16 rounded" style={{ backgroundColor: glass }} />
      </HStack>
      <Spacing size={52} />
      <VStack mx={20} py={16} px={16} gap={12} className="rounded-2xl self-stretch">
        <Skeleton className="h-5 w-20 rounded" style={{ backgroundColor: glass }} />
        <Skeleton className="h-24 w-full rounded-xl" style={{ backgroundColor: glass }} />
      </VStack>
    </VStack>
  );
};

CurrentWeather.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['weather', 'common']);

  return match(error)
    .with(
      P.when((value) => isApiError(value) && value.hasCode(ErrorCode.WEATHER_1902)),
      () => <WeatherLocationPrompt />,
    )
    .with(
      P.when((value) => isApiError(value) && value.hasCode(ErrorCode.WEATHER_1901)),
      () => (
        <WeatherMessage
          title={t('weather:screen.kmaPreparing')}
          description={t('weather:screen.checkLater')}
          action={t('common:actions.retry')}
          onAction={reset}
        />
      ),
    )
    .otherwise(() => (
      <WeatherMessage
        title={t('weather:screen.loadFailed')}
        description={t('weather:screen.retryLater')}
        action={t('common:actions.retry')}
        onAction={reset}
      />
    ));
};

function Stat({ label, value }: { label: string; value: string }) {
  const palette = useTimePalette();

  return (
    <VStack align="center" gap={4}>
      <Text size="b3" style={{ color: palette.textSub }}>
        {label}
      </Text>
      <Text size="b1" weight="semibold" style={{ color: palette.text }}>
        {value}
      </Text>
    </VStack>
  );
}

function StatDivider() {
  const palette = useTimePalette();

  return <View className="w-px h-12 opacity-20" style={{ backgroundColor: palette.textSub }} />;
}
