import { ErrorCode } from '@aido/api/errors';
import catImage from '@assets/images/cat_weather_anchor.png';
import type { DailyForecast } from '@src/features/weather/models/weather.model';
import { WeatherPolicy } from '@src/features/weather/models/weather.model';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { WeatherLocationPrompt } from '@src/features/weather/presentations/components/WeatherLocationPrompt';
import {
  getPrecipitationTypeLabel,
  getSkyConditionLabel,
} from '@src/features/weather/presentations/constants/weather-labels.constant';
import { useTimePalette } from '@src/features/weather/presentations/hooks/use-time-palette';
import { useWeatherSession } from '@src/features/weather/presentations/providers/weather-session-provider';
import { useGetConditionsQueryOptions } from '@src/features/weather/presentations/queries/get-conditions-query-options';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/get-forecast-query-options';
import {
  type HourlyForecastViewModel,
  toUpcomingHourlyForecasts,
} from '@src/features/weather/presentations/view-models/hourly-forecast.view-model';
import type { WeatherForecastViewModel } from '@src/features/weather/presentations/view-models/weather-forecast.view-model';
import { isApiError } from '@src/shared/errors/api-error';
import { t as globalT, useTranslation } from '@src/shared/i18n';
import { Box, CrosshairIcon, HStack, Result, Spacing, Text, VStack } from '@src/shared/ui';
import { WeatherSunriseIcon, WeatherSunsetIcon } from '@src/shared/ui/Icon';
import { getWeekdayLabels } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Skeleton } from 'heroui-native';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

export default function WeatherDetailScreen() {
  const { t } = useTranslation(['weather', 'common']);
  const palette = useTimePalette();
  const session = useWeatherSession();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const forecastQuery = useQuery(useGetForecastQueryOptions(session.clock.date));
  const conditionsQuery = useQuery(useGetConditionsQueryOptions());
  const forecast = forecastQuery.data;
  const conditions = conditionsQuery.data;
  const retryForecast = () => {
    void forecastQuery.refetch();
  };

  if (session.status === 'unsupported') {
    return (
      <WeatherDetailScreen.Empty
        title={t('weather:screen.domesticOnly')}
        description={t('weather:screen.domesticOnlyDescription')}
        action={t('weather:screen.refreshLocation')}
        onPress={() => {
          void session.syncLocation(true);
        }}
      />
    );
  }
  if (
    session.status === 'checking' ||
    (!forecast && (forecastQuery.isPending || session.isSyncing))
  ) {
    return <WeatherDetailScreen.Loading />;
  }
  if (!forecast) {
    const error = forecastQuery.error;
    if (
      session.status === 'unregistered' ||
      session.status === 'denied' ||
      (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902))
    )
      return <WeatherLocationPrompt />;
    if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1901)) {
      return (
        <WeatherDetailScreen.Empty
          title={t('weather:screen.kmaPreparing')}
          description={t('weather:screen.checkLater')}
          action={t('common:actions.retry')}
          onPress={retryForecast}
        />
      );
    }
    return (
      <WeatherDetailScreen.Error
        title={t('weather:screen.loadFailed')}
        description={t('weather:screen.retryLater')}
        action={t('common:actions.retry')}
        onPress={retryForecast}
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: headerHeight + 24, paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl
          tintColor={palette.text}
          refreshing={forecastQuery.isFetching && !forecastQuery.isPending}
          onRefresh={() => {
            void forecastQuery.refetch();
            void conditionsQuery.refetch();
          }}
        />
      }
    >
      <WeatherLocation />
      <Spacing size={4} />
      <TodayTemperature forecast={forecast} />
      {forecast.currentTemperature === null && (
        <Text size="b4" align="center" style={{ color: palette.textSub }}>
          {t('weather:screen.dailyRange')}
        </Text>
      )}
      <Spacing size={32} />
      <WeatherStats forecast={forecast} />
      <Spacing size={20} />
      {conditions?.feelsLikeTemperature != null && (
        <>
          <FeelsLike feelsLike={conditions.feelsLikeTemperature} />
          <Spacing size={32} />
        </>
      )}
      <HourlyForecastSection
        items={toUpcomingHourlyForecasts(forecast.hourlyForecasts, session.clock.hour)}
      />
      {forecast.dailyForecasts.length > 0 && (
        <DailyForecastSection items={forecast.dailyForecasts} />
      )}
      {conditions && (
        <>
          <SunTime sunrise={conditions.sunrise} sunset={conditions.sunset} />
          <DustInfo pm10={conditions.pm10} pm25={conditions.pm25} />
        </>
      )}
      {(forecastQuery.error || conditionsQuery.error || session.status === 'error') && (
        <VStack align="center" gap={12} px={24} py={16}>
          <Text size="b4" align="center" style={{ color: palette.textSub }}>
            {t(
              session.status === 'error'
                ? 'weather:toasts.locationFailed'
                : 'weather:screen.refreshFailed',
            )}
          </Text>
          <Result.Button
            onPress={() => {
              void session.syncLocation(true);
              void forecastQuery.refetch();
              void conditionsQuery.refetch();
            }}
          >
            {t('common:actions.retry')}
          </Result.Button>
        </VStack>
      )}
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
      <TouchableOpacity
        onPress={() => {
          void session.syncLocation(true);
        }}
        disabled={session.isSyncing}
        accessibilityRole="button"
        accessibilityLabel={t('screen.refreshLocation')}
        style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
        activeOpacity={0.4}
      >
        {session.isSyncing ? (
          <ActivityIndicator color={palette.textSub} />
        ) : (
          <CrosshairIcon width={18} height={18} color={palette.textSub} />
        )}
      </TouchableOpacity>
    </HStack>
  );
}

function TodayTemperature({ forecast }: { forecast: WeatherForecastViewModel }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const showPrecipitation = WeatherPolicy.shouldShowPrecipitation(forecast);
  const ForecastIcon =
    (showPrecipitation && resolveIconByPrecipitation(forecast.precipitationType)) ||
    resolveIconBySky(forecast.skyCondition);
  const forecastIconColor = showPrecipitation
    ? palette.text
    : resolveSkyIconColor(forecast.skyCondition, palette.text);
  const currentTemp = forecast.currentTemperature;

  return (
    <VStack align="center" gap={8}>
      <Text
        className={
          currentTemp === null
            ? 'text-[48px] leading-[56px] font-medium'
            : 'text-[80px] leading-[88px] font-medium tracking-[-2.4px]'
        }
        style={{ color: palette.text }}
      >
        {currentTemp !== null
          ? `${currentTemp}°`
          : `${Math.round(forecast.temperatureMin)}°–${Math.round(forecast.temperatureMax)}°`}
      </Text>

      <HStack gap={4} align="center">
        <Text size="b2" style={{ color: palette.textSub }}>
          {t('screen.tempLow')}
        </Text>
        <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
          {Math.round(forecast.temperatureMin)}°
        </Text>
        <Text size="b2" style={{ color: palette.textSub }}>
          {' / '}
          {t('screen.tempHigh')}
        </Text>
        <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
          {Math.round(forecast.temperatureMax)}°
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

      {WeatherPolicy.shouldShowPrecipitation(forecast) && (
        <Box px={14} py={5}>
          <Text size="b3" weight="medium" style={{ color: palette.icon }}>
            {getPrecipitationTypeLabel(forecast.precipitationType)}{' '}
            {forecast.precipitationProbability}%
          </Text>
        </Box>
      )}
    </VStack>
  );
}

function WeatherStats({ forecast }: { forecast: WeatherForecastViewModel }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  return (
    <HStack align="center" className="justify-center gap-5">
      <StatItem label={t('screen.wind')} value={`${forecast.windSpeed} m/s`} />
      <View className="w-px h-12 opacity-20" style={{ backgroundColor: palette.textSub }} />
      <StatItem label={t('screen.humidity')} value={`${forecast.humidity}%`} />
      <View className="w-px h-12 opacity-20" style={{ backgroundColor: palette.textSub }} />
      <StatItem label={t('screen.precipProb')} value={`${forecast.precipitationProbability}%`} />
    </HStack>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
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

function FeelsLike({ feelsLike }: { feelsLike: number }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  return (
    <View className="items-center">
      <Box px={16} py={8} className="rounded-[20px]" style={{ backgroundColor: palette.glass }}>
        <Text size="b4" weight="medium" style={{ color: palette.text }}>
          {t('screen.feelsLike', { temp: Math.round(feelsLike) })}
        </Text>
      </Box>
    </View>
  );
}

function HourlyForecastSection({ items }: { items: HourlyForecastViewModel[] }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="relative mt-16">
      <Image
        source={catImage}
        className="absolute right-8 w-[140px] h-[102px] z-10"
        style={{ top: -102 }}
        resizeMode="contain"
      />
      <VStack
        mx={20}
        py={16}
        px={16}
        gap={12}
        mb={12}
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: palette.glassCard }}
      >
        <Text size="b3" weight="semibold" className="mb-1" style={{ color: palette.text }}>
          {t('screen.hourly')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {items.map((item) => (
            <HourlyForecastSection.Item key={item.id} item={item} />
          ))}
        </ScrollView>
      </VStack>
    </View>
  );
}

HourlyForecastSection.Item = function Item({ item }: { item: HourlyForecastViewModel }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const SkyIcon = resolveIconBySky(item.skyCondition);

  return (
    <VStack py={16} px={20} className="items-center justify-between">
      <Text size="b3" align="center" style={{ color: palette.textSub }}>
        {t(item.dayOffset > 0 ? 'screen.nextDayHourLabel' : 'screen.hourLabel', {
          hour: item.hour,
        })}
      </Text>

      <Spacing size={8} />

      <SkyIcon
        width={24}
        height={24}
        color={resolveSkyIconColor(item.skyCondition, palette.icon)}
      />

      {item.precipitationProbability > 0 ? (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.precipitationProbability}%
        </Text>
      ) : (
        <View style={{ height: 14 }} />
      )}

      <Spacing size={8} />

      <Text size="b3" weight="medium" align="center" style={{ color: palette.textSub }}>
        {Math.round(item.temperature)}°
      </Text>
    </VStack>
  );
};

function DailyForecastSection({ items }: { items: DailyForecast[] }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  const globalMin = Math.min(...items.map((i) => i.temperatureMin));
  const globalMax = Math.max(...items.map((i) => i.temperatureMax));
  const range = globalMax - globalMin || 1;

  return (
    <VStack
      mx={20}
      py={16}
      px={16}
      gap={8}
      mb={12}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: palette.glassCard }}
    >
      <Text size="b3" weight="semibold" className="mb-1" style={{ color: palette.text }}>
        {t('screen.weekly')}
      </Text>
      {items.map((item) => {
        const Icon =
          resolveIconByPrecipitation(item.precipitationType) ?? resolveIconBySky(item.skyCondition);
        const iconColor =
          item.precipitationType === 'NONE'
            ? resolveSkyIconColor(item.skyCondition, palette.icon)
            : palette.icon;
        const dayLabel = formatDayLabel(item.date);
        const barLeft = ((item.temperatureMin - globalMin) / range) * 100;
        const barRight = ((globalMax - item.temperatureMax) / range) * 100;

        return (
          <HStack key={item.date} align="center" className="py-1 gap-3 px-1">
            <Text size="b3" weight="medium" className="w-8" style={{ color: palette.textSub }}>
              {dayLabel}
            </Text>

            <VStack align="center" className="w-10">
              <Icon width={20} height={20} color={iconColor} />
              {item.precipitationProbability > 0 && (
                <Text size="e2" style={{ color: palette.accent }}>
                  {item.precipitationProbability}%
                </Text>
              )}
            </VStack>

            <Text size="b3" weight="medium" className="w-8 text-right" style={{ color: '#A0D8FF' }}>
              {Math.round(item.temperatureMin)}°
            </Text>
            <View
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: palette.glass }}
            >
              <View
                className="absolute h-1 rounded-full overflow-hidden"
                style={{ left: `${barLeft}%`, right: `${barRight}%` }}
              >
                <Svg width="100%" height={4}>
                  <Defs>
                    <SvgLinearGradient id={`tempBar-${item.date}`} x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={getTempColor(item.temperatureMin)} />
                      <Stop offset="1" stopColor={getTempColor(item.temperatureMax)} />
                    </SvgLinearGradient>
                  </Defs>
                  <Rect width="100%" height={4} rx={2} fill={`url(#tempBar-${item.date})`} />
                </Svg>
              </View>
            </View>
            <Text size="b3" weight="medium" className="w-8" style={{ color: palette.text }}>
              {Math.round(item.temperatureMax)}°
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}

function SunTime({ sunrise, sunset }: { sunrise: string | null; sunset: string | null }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  if (sunrise == null && sunset == null) return null;

  return (
    <VStack
      mx={20}
      py={16}
      px={16}
      mb={12}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: palette.glassCard }}
    >
      <HStack gap={20} className="justify-center">
        {sunrise != null && (
          <VStack align="center" gap={4}>
            <HStack align="center" gap={4}>
              <WeatherSunriseIcon width={18} height={18} color={palette.textSub} />
              <Text size="b4" style={{ color: palette.textSub }}>
                {t('screen.sunrise')}
              </Text>
            </HStack>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {sunrise}
            </Text>
          </VStack>
        )}
        {sunset != null && (
          <VStack align="center" gap={4}>
            <HStack align="center" gap={4}>
              <WeatherSunsetIcon width={18} height={18} color={palette.textSub} />
              <Text size="b4" style={{ color: palette.textSub }}>
                {t('screen.sunset')}
              </Text>
            </HStack>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {sunset}
            </Text>
          </VStack>
        )}
      </HStack>
    </VStack>
  );
}

function DustInfo({ pm10, pm25 }: { pm10: number | null; pm25: number | null }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  if (pm10 == null && pm25 == null) return null;

  return (
    <VStack
      mx={20}
      py={16}
      px={16}
      mb={12}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: palette.glassCard }}
    >
      <HStack gap={20} className="justify-center">
        {pm10 != null && (
          <VStack align="center" gap={4}>
            <Text size="b4" style={{ color: palette.textSub }}>
              {t('screen.pm10')}
            </Text>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {getDustGrade(pm10, 'pm10')}
            </Text>
          </VStack>
        )}
        {pm25 != null && (
          <VStack align="center" gap={4}>
            <Text size="b4" style={{ color: palette.textSub }}>
              {t('screen.pm25')}
            </Text>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {getDustGrade(pm25, 'pm25')}
            </Text>
          </VStack>
        )}
      </HStack>
    </VStack>
  );
}

function getDustGrade(value: number, type: 'pm10' | 'pm25'): string {
  const thresholds = type === 'pm10' ? ([30, 80, 150] as const) : ([15, 35, 75] as const);
  if (value <= thresholds[0]) return globalT('weather:dust.good');
  if (value <= thresholds[1]) return globalT('weather:dust.normal');
  if (value <= thresholds[2]) return globalT('weather:dust.bad');
  return globalT('weather:dust.veryBad');
}

function getTempColor(temp: number): string {
  if (temp >= 35) return '#FF3B30';
  if (temp >= 30) return '#FF8A80';
  if (temp >= 25) return '#FF9500';
  if (temp >= 20) return '#F5C842';
  if (temp >= 15) return '#8BC34A';
  if (temp >= 10) return '#4FC3F7';
  if (temp >= 5) return '#A0D8FF';
  return '#2196F3';
}

function formatDayLabel(dateStr: string): string {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return getWeekdayLabels()[day] ?? '';
}

WeatherDetailScreen.Loading = function Loading() {
  const headerHeight = useHeaderHeight();
  const palette = useTimePalette();
  const glass = palette.glass;

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

WeatherDetailScreen.Error = function ErrorState({
  title,
  description,
  action,
  onPress,
}: {
  title: string;
  description: string;
  action: string;
  onPress: () => void;
}) {
  const palette = useTimePalette();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  return (
    <VStack
      flex={1}
      align="center"
      justify="center"
      px={24}
      style={{ paddingTop: headerHeight, paddingBottom: insets.bottom }}
    >
      <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
        {title}
      </Text>
      <Spacing size={4} />
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {description}
      </Text>
      <Spacing size={24} />
      <Result.Button onPress={onPress}>{action}</Result.Button>
    </VStack>
  );
};
WeatherDetailScreen.Empty = WeatherDetailScreen.Error;
