import { ErrorCode } from '@aido/errors';
import catImage from '@assets/images/cat_weather_anchor.png';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import type { DailyForecast, HourlyForecast } from '@src/features/weather/models/weather.model';
import { WeatherPolicy } from '@src/features/weather/models/weather.model';
import { WeatherLocationPrompt } from '@src/features/weather/presentations/components/WeatherLocationPrompt';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import {
  PRECIPITATION_TYPE_LABEL,
  SKY_CONDITION_LABEL,
} from '@src/features/weather/presentations/constants/weather-labels.constant';
import {
  getTimeOfDay,
  TIME_PALETTES,
  TimePaletteContext,
  useTimePalette,
} from '@src/features/weather/presentations/hooks/use-time-palette';
import { useGetConditionsQueryOptions } from '@src/features/weather/presentations/queries/use-get-conditions-query-options';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { useUpdateLocationMutationOptions } from '@src/features/weather/presentations/queries/use-update-location-mutation-options';
import type { WeatherForecastViewModel } from '@src/features/weather/presentations/view-models/weather-forecast.view-model';
import { isApiError } from '@src/shared/errors/api-error';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useLocationPermission } from '@src/shared/hooks/useLocationPermission';
import { Box, CrosshairIcon, HStack, Spacing, Text, VStack } from '@src/shared/ui';
import { WeatherSunriseIcon, WeatherSunsetIcon } from '@src/shared/ui/Icon';
import { formatDate, isDateToday } from '@src/shared/utils/date';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Skeleton } from 'heroui-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

export default function WeatherDetailScreen() {
  const palette = TIME_PALETTES[getTimeOfDay()];
  const insets = useSafeAreaInsets();
  const [selectedDate] = useFeedDate();
  const {
    data: forecast,
    error,
    isPending,
    isFetching,
  } = useQuery({
    ...useGetForecastQueryOptions(formatDate(selectedDate)),
    placeholderData: keepPreviousData,
  });
  const isRefreshing = isFetching && !isPending;
  const { data: conditions } = useQuery({
    ...useGetConditionsQueryOptions(),
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <TimePaletteContext.Provider value={palette}>
        <View className="flex-1" style={{ backgroundColor: palette.bg }}>
          <GradientBackground />
          <ForecastSkeleton insetTop={insets.top} />
        </View>
      </TimePaletteContext.Provider>
    );
  }

  if (error) {
    if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)) {
      return (
        <TimePaletteContext.Provider value={palette}>
          <View className="flex-1" style={{ backgroundColor: palette.bg }}>
            <GradientBackground />
            <WeatherLocationPrompt />
          </View>
        </TimePaletteContext.Provider>
      );
    }

    if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1901)) {
      return (
        <TimePaletteContext.Provider value={palette}>
          <View className="flex-1" style={{ backgroundColor: palette.bg }}>
            <GradientBackground />
            <VStack align="center" justify="center" flex={1}>
              <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
                기상청 데이터 준비 중이에요
              </Text>
              <Spacing size={4} />
              <Text size="b4" align="center" style={{ color: palette.textSub }}>
                잠시 후 다시 확인해주세요
              </Text>
            </VStack>
          </View>
        </TimePaletteContext.Provider>
      );
    }

    return (
      <TimePaletteContext.Provider value={palette}>
        <View className="flex-1" style={{ backgroundColor: palette.bg }}>
          <GradientBackground />
          <VStack align="center" justify="center" flex={1}>
            <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
              날씨 정보를 불러올 수 없어요
            </Text>
            <Spacing size={4} />
            <Text size="b4" align="center" style={{ color: palette.textSub }}>
              잠시 후 다시 시도해주세요
            </Text>
          </VStack>
        </View>
      </TimePaletteContext.Provider>
    );
  }

  return (
    <TimePaletteContext.Provider value={palette}>
      <View className="flex-1" style={{ backgroundColor: palette.bg }}>
        <GradientBackground />
        {isRefreshing && (
          <View className="absolute inset-0 z-10 items-center justify-center">
            <ActivityIndicator size="large" color={palette.text} />
          </View>
        )}
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 24,
          }}
          style={{ opacity: isRefreshing ? 0.4 : 1 }}
        >
          <WeatherLocation latitude={forecast.latitude} longitude={forecast.longitude} />

          <Spacing size={4} />

          <TodayTemperature forecast={forecast} />

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
            items={filterHourlyForecasts(forecast.hourlyForecasts, selectedDate)}
          />
          {forecast.dailyForecasts?.length > 0 && (
            <DailyForecastSection items={forecast.dailyForecasts} />
          )}
          {conditions && (
            <>
              <SunTime sunrise={conditions.sunrise} sunset={conditions.sunset} />
              <DustInfo pm10={conditions.pm10} pm25={conditions.pm25} />
            </>
          )}
        </ScrollView>
      </View>
    </TimePaletteContext.Provider>
  );
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

function useLocationName(location: LocationCoords | null): string | null {
  const [name, setName] = useState<string | null>(null);

  const lat = location?.latitude;
  const lng = location?.longitude;

  useEffect(() => {
    if (lat == null || lng == null) return;

    let cancelled = false;

    (async () => {
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });

        if (geo && !cancelled) {
          const parts = [geo.city, geo.district].filter(Boolean);
          setName(parts.join(' ') || null);
        }
      } catch {
        // 역지오코딩 실패 시 무시
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return name;
}

function WeatherLocation({ latitude, longitude }: LocationCoords) {
  const palette = useTimePalette();
  const toast = useAppToast();
  const { mutate: updateLocation, isPending } = useMutation(useUpdateLocationMutationOptions());
  const { requestPermissionAndExecute } = useLocationPermission((message) =>
    toast.warning(message),
  );
  const locationName = useLocationName({ latitude, longitude });

  const handleRefresh = useCallback(async () => {
    await requestPermissionAndExecute(async () => {
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        updateLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        toast.error('위치를 가져올 수 없어요');
      }
    });
  }, [requestPermissionAndExecute, toast, updateLocation]);

  if (!locationName) return null;

  return (
    <HStack align="center" gap={4} justify="center">
      <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
        {locationName}
      </Text>
      <TouchableOpacity
        onPress={handleRefresh}
        disabled={isPending}
        hitSlop={8}
        activeOpacity={0.4}
      >
        <CrosshairIcon width={18} height={18} color={palette.textSub} />
      </TouchableOpacity>
    </HStack>
  );
}

function TodayTemperature({ forecast }: { forecast: WeatherForecastViewModel }) {
  const palette = useTimePalette();
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
        className="text-[80px] leading-[88px] font-medium tracking-[-2.4px]"
        style={{ color: palette.text }}
      >
        {currentTemp}°
      </Text>

      <HStack gap={4} align="center">
        <Text size="b2" style={{ color: palette.textSub }}>
          최저
        </Text>
        <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
          {Math.round(forecast.temperatureMin)}°
        </Text>
        <Text size="b2" style={{ color: palette.textSub }}>
          {' '}
          / 최고
        </Text>
        <Text size="b2" weight="medium" style={{ color: palette.textSub }}>
          {Math.round(forecast.temperatureMax)}°
        </Text>
      </HStack>

      <HStack gap={8} align="center" className="mt-2">
        <ForecastIcon width={18} height={18} color={forecastIconColor} />
        <Text size="b2" weight="semibold" style={{ color: palette.text }}>
          {showPrecipitation
            ? PRECIPITATION_TYPE_LABEL[forecast.precipitationType]
            : SKY_CONDITION_LABEL[forecast.skyCondition]}
        </Text>
      </HStack>

      {WeatherPolicy.shouldShowPrecipitation(forecast) && (
        <Box px={14} py={5}>
          <Text size="b3" weight="medium" style={{ color: palette.icon }}>
            {PRECIPITATION_TYPE_LABEL[forecast.precipitationType]}{' '}
            {forecast.precipitationProbability}%
          </Text>
        </Box>
      )}
    </VStack>
  );
}

function WeatherStats({ forecast }: { forecast: WeatherForecastViewModel }) {
  const palette = useTimePalette();

  return (
    <HStack align="center" className="justify-center gap-5">
      <StatItem label="바람" value={`${forecast.windSpeed} m/s`} />
      <View className="w-px h-12 opacity-20" style={{ backgroundColor: palette.textSub }} />
      <StatItem label="습도" value={`${forecast.humidity}%`} />
      <View className="w-px h-12 opacity-20" style={{ backgroundColor: palette.textSub }} />
      <StatItem label="강수확률" value={`${forecast.precipitationProbability}%`} />
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

  return (
    <View className="items-center">
      <Box px={16} py={8} className="rounded-[20px]" style={{ backgroundColor: palette.glass }}>
        <Text size="b4" weight="medium" style={{ color: palette.text }}>
          체감온도 {Math.round(feelsLike)}°로 예상된다냥
        </Text>
      </Box>
    </View>
  );
}

function filterHourlyForecasts(items: HourlyForecast[], selectedDate: Date): HourlyForecast[] {
  if (!isDateToday(selectedDate)) {
    return items.slice(0, 24);
  }

  const currentHour = new Date().getHours();
  const startIndex = items.findIndex((item) => item.hour >= currentHour);
  if (startIndex === -1) {
    return items.slice(24, 48);
  }
  return items.slice(startIndex, startIndex + 24);
}

function HourlyForecastSection({ items }: { items: HourlyForecast[] }) {
  const palette = useTimePalette();

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
          시간별 예보
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {items.map((item, i) => (
            <HourlyCard key={`${item.hour}-${i}`} item={item} />
          ))}
        </ScrollView>
      </VStack>
    </View>
  );
}

function HourlyCard({ item }: { item: HourlyForecast }) {
  const palette = useTimePalette();
  const SkyIcon = resolveIconBySky(item.skyCondition);

  return (
    <VStack py={16} px={20} className="items-center justify-between">
      <Text size="b3" align="center" style={{ color: palette.textSub }}>
        {item.hour}시
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
}

function DailyForecastSection({ items }: { items: DailyForecast[] }) {
  const palette = useTimePalette();

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
        주간 예보
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
                일출
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
                일몰
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
              미세먼지
            </Text>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {getDustGrade(pm10, 'pm10')}
            </Text>
          </VStack>
        )}
        {pm25 != null && (
          <VStack align="center" gap={4}>
            <Text size="b4" style={{ color: palette.textSub }}>
              초미세먼지
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
  if (value <= thresholds[0]) return '좋음';
  if (value <= thresholds[1]) return '보통';
  if (value <= thresholds[2]) return '나쁨';
  return '매우나쁨';
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
  const days = ['일', '월', '화', '수', '목', '금', '토'] as const;
  const d = new Date(dateStr);
  return days[d.getDay()] as string;
}

function ForecastSkeleton({ insetTop }: { insetTop: number }) {
  const palette = useTimePalette();
  const glass = palette.glass;

  return (
    <VStack align="center" style={{ paddingTop: insetTop + 80 }}>
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
}

function GradientBackground() {
  const palette = useTimePalette();
  const { width, height } = Dimensions.get('window');

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={palette.gradient[0]} />
          <Stop offset="0.5" stopColor={palette.gradient[1]} />
          <Stop offset="1" stopColor={palette.gradient[2]} />
        </SvgLinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#bg)" />
    </Svg>
  );
}
