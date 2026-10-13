import { AirQuality } from '@src/features/weather/components/air-quality';
import { CurrentWeather } from '@src/features/weather/components/current-weather';
import { DailyForecast } from '@src/features/weather/components/daily-forecast';
import { FeelsLikeTemperature } from '@src/features/weather/components/feels-like-temperature';
import { HourlyForecast } from '@src/features/weather/components/hourly-forecast';
import { useWeatherSession } from '@src/features/weather/components/providers/weather-session-provider';
import { SunriseSunset } from '@src/features/weather/components/sunrise-sunset';
import { WeatherMessage } from '@src/features/weather/components/weather-message';
import { useTimePalette } from '@src/features/weather/hooks/use-time-palette';
import { useGetConditionsQueryOptions } from '@src/features/weather/queries/get-conditions-query-options';
import { useGetForecastQueryOptions } from '@src/features/weather/queries/get-forecast-query-options';
import { refetchWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  CrosshairIcon,
  HStack,
  QueryErrorBoundary,
  Result,
  Spacing,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { PressableFeedback } from 'heroui-native';
import { type PropsWithChildren, Suspense } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

export default function WeatherDetailScreen() {
  const { t } = useTranslation(['weather', 'common']);
  const session = useWeatherSession();

  return match(session.status)
    .with('unsupported', () => (
      <WeatherMessage
        title={t('weather:screen.domesticOnly')}
        description={t('weather:screen.domesticOnlyDescription')}
        action={t('weather:screen.refreshLocation')}
        onAction={() => session.syncLocation(true)}
      />
    ))
    .with('checking', () => <CurrentWeather.Loading />)
    .with('registered', 'unregistered', 'denied', 'error', (status) => (
      <QueryErrorBoundary
        fallback={CurrentWeather.Error}
        resetKeys={[status, session.locationRevision]}
      >
        <Suspense fallback={<CurrentWeather.Loading />}>
          <WeatherScrollView>
            <WeatherLocation />

            <Spacing size={4} />

            <CurrentWeather />

            <Spacing size={20} />

            {status === 'registered' && (
              <Suspense fallback={null}>
                <FeelsLikeTemperature />
              </Suspense>
            )}

            <HourlyForecast />
            <DailyForecast />

            {status === 'registered' && (
              <QueryErrorBoundary fallback={() => null} resetKeys={[session.locationRevision]}>
                <Suspense fallback={null}>
                  <SunriseSunset />
                  <AirQuality />
                </Suspense>
              </QueryErrorBoundary>
            )}

            <WeatherRefreshNotice />
          </WeatherScrollView>
        </Suspense>
      </QueryErrorBoundary>
    ))
    .exhaustive();
}

function WeatherScrollView({ children }: PropsWithChildren) {
  const palette = useTimePalette();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [isRefreshing, refresh] = useRefresh(() => refetchWeather(queryClient));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: headerHeight + 24, paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl tintColor={palette.text} refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      {children}
    </ScrollView>
  );
}

function WeatherLocation() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const session = useWeatherSession();

  return (
    <HStack align="center" gap={4} justify="center">
      <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
        {session.locationName ?? t('screen.registeredLocation')}
      </Text>
      <PressableFeedback
        onPress={() => session.syncLocation(true)}
        isDisabled={session.isSyncing}
        accessibilityRole="button"
        accessibilityLabel={t('screen.refreshLocation')}
        className="min-h-11 min-w-11 items-center justify-center"
      >
        {session.isSyncing ? (
          <ActivityIndicator color={palette.textSub} />
        ) : (
          <CrosshairIcon width={18} height={18} color={palette.textSub} />
        )}
      </PressableFeedback>
    </HStack>
  );
}

/** 예보를 이미 보여 주는 중 갱신이나 위치 확인에 실패하면 마지막 예보임을 알린다. */
function WeatherRefreshNotice() {
  const palette = useTimePalette();
  const { t } = useTranslation(['weather', 'common']);
  const session = useWeatherSession();
  const queryClient = useQueryClient();
  const forecast = useQuery(useGetForecastQueryOptions());
  const conditions = useQuery({
    ...useGetConditionsQueryOptions(),
    enabled: session.status === 'registered',
  });

  if (forecast.error == null && conditions.error == null && session.status !== 'error') {
    return null;
  }

  return (
    <VStack align="center" gap={12} px={24} py={16}>
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {t(
          session.status === 'error'
            ? 'weather:toasts.locationFailed'
            : 'weather:screen.refreshFailed',
        )}
      </Text>
      <Result.Button
        onPress={() => Promise.all([session.syncLocation(true), refetchWeather(queryClient)])}
      >
        {t('common:actions.retry')}
      </Result.Button>
    </VStack>
  );
}
