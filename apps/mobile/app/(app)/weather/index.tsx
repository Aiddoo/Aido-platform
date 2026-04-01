import { ErrorCode } from '@aido/errors';
import catImage from '@assets/images/cat_weather_anchor.png';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import type {
  DailyForecast,
  HourlyForecast,
  WeatherForecast,
} from '@src/features/weather/models/weather.model';
import { WeatherPolicy } from '@src/features/weather/models/weather.model';
import { WeatherLocationPrompt } from '@src/features/weather/presentations/components/WeatherLocationPrompt';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import {
  PRECIPITATION_TYPE_LABEL,
  SKY_CONDITION_LABEL,
} from '@src/features/weather/presentations/constants/weather-labels.constant';
import { useGetConditionsQueryOptions } from '@src/features/weather/presentations/queries/use-get-conditions-query-options';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { Box, HStack, Result, Spacing, Text, VStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Skeleton } from 'heroui-native';
import { createContext, useContext, useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const TIME_PALETTES = {
  dawn: {
    bg: '#1B1464',
    gradient: ['#1B1464', '#7B5EA7', '#E8A87C'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    iconSun: '#FFD233',
    glass: 'rgba(20,0,50,0.20)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(20,0,50,0.25)',
    accent: '#F5B078',
  },
  day: {
    bg: '#1976D2',
    gradient: ['#1976D2', '#42A5F5', '#90CAF9'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    iconSun: '#FFD233',
    glass: 'rgba(0,20,60,0.18)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(0,20,60,0.22)',
    accent: '#FFFFFF',
  },
  dusk: {
    bg: '#281740',
    gradient: ['#281740', '#8B4A6B', '#CA6668'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    iconSun: '#FFD233',
    glass: 'rgba(15,5,30,0.22)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(15,5,30,0.25)',
    accent: '#FFB088',
  },
  night: {
    bg: '#080C1A',
    gradient: ['#080C1A', '#101D3A', '#1A3355'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.75)',
    icon: '#FFFFFF',
    iconSun: '#FFD233',
    glass: 'rgba(140,170,220,0.10)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(140,170,220,0.20)',
    accent: '#7DB4F5',
  },
} as const;

type TimeOfDay = keyof typeof TIME_PALETTES;
type TimePalette = (typeof TIME_PALETTES)[TimeOfDay];

const TimePaletteContext = createContext<TimePalette>(TIME_PALETTES.night);

function useTimePalette(): TimePalette {
  return useContext(TimePaletteContext);
}

export default function WeatherDetailScreen() {
  const palette = TIME_PALETTES[getTimeOfDay()];
  const insets = useSafeAreaInsets();
  const [selectedDate] = useFeedDate();
  const {
    data: forecast,
    error,
    isPending,
  } = useQuery(useGetForecastQueryOptions(formatDate(selectedDate)));
  const { data: conditions } = useQuery(useGetConditionsQueryOptions());

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
            <Box p={16} style={{ marginTop: insets.top + 40 }}>
              <WeatherLocationPrompt />
            </Box>
          </View>
        </TimePaletteContext.Provider>
      );
    }

    if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1901) && isKmaPreparationTime()) {
      return (
        <TimePaletteContext.Provider value={palette}>
          <View className="flex-1" style={{ backgroundColor: palette.bg }}>
            <GradientBackground />
            <Result
              title="기상청 데이터 준비 중이에요"
              description="자정~새벽 2시에는 기상청 데이터가 갱신돼요. 잠시 후 다시 확인해주세요"
            />
          </View>
        </TimePaletteContext.Provider>
      );
    }

    return (
      <TimePaletteContext.Provider value={palette}>
        <View className="flex-1" style={{ backgroundColor: palette.bg }}>
          <GradientBackground />
          <Result title="날씨 정보를 불러올 수 없어요" description="잠시 후 다시 시도해주세요" />
        </View>
      </TimePaletteContext.Provider>
    );
  }

  return (
    <TimePaletteContext.Provider value={palette}>
      <View className="flex-1" style={{ backgroundColor: palette.bg }}>
        <GradientBackground />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <WeatherLocation />

          <Spacing size={4} />

          <TodayTemperature forecast={forecast} />

          <Spacing size={40} />

          <WeatherStats forecast={forecast} />

          <Spacing size={32} />

          {conditions?.feelsLikeTemperature != null && (
            <>
              <FeelsLike feelsLike={conditions.feelsLikeTemperature} />
              <Spacing size={40} />
            </>
          )}

          <HourlyForecastSection items={forecast.hourlyForecasts} />
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

function useLocationName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (!pos || cancelled) return;

        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });

        if (geo && !cancelled) {
          const parts = [geo.city, geo.district].filter(Boolean);
          setName(parts.join(' ') || null);
        }
      } catch {
        // 위치 권한 없거나 역지오코딩 실패 시 무시
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}

function WeatherLocation() {
  const palette = useTimePalette();
  const locationName = useLocationName();

  if (!locationName) return null;

  return (
    <View className="items-center">
      <Text size="b3" weight="medium" style={{ color: palette.textSub }}>
        {locationName}
      </Text>
    </View>
  );
}

function TodayTemperature({ forecast }: { forecast: WeatherForecast }) {
  const palette = useTimePalette();
  const ForecastIcon =
    resolveIconByPrecipitation(forecast.precipitationType) ??
    resolveIconBySky(forecast.skyCondition);
  const avgTemp = Math.round((forecast.temperatureMin + forecast.temperatureMax) / 2);

  return (
    <VStack align="center" gap={8}>
      <Text
        className="text-[80px] leading-[88px] font-semibold tracking-[-2.4px]"
        style={{ color: palette.text }}
      >
        {avgTemp}
      </Text>

      <HStack gap={4} align="center">
        <Text size="b3" style={{ color: palette.textSub }}>
          최저
        </Text>
        <Text size="b3" weight="medium" style={{ color: '#319CFC' }}>
          {Math.round(forecast.temperatureMin)}°
        </Text>
        <Text size="b3" style={{ color: palette.textSub }}>
          {' '}
          / 최고
        </Text>
        <Text size="b3" weight="medium" style={{ color: '#F0503D' }}>
          {Math.round(forecast.temperatureMax)}°
        </Text>
      </HStack>

      <HStack gap={8} align="center" className="mt-2">
        <ForecastIcon width={18} height={18} color={palette.text} />
        <Text size="b3" weight="semibold" style={{ color: palette.text }}>
          {SKY_CONDITION_LABEL[forecast.skyCondition]}
        </Text>
      </HStack>

      {WeatherPolicy.shouldShowPrecipitation(forecast) && (
        <Box
          px={14}
          py={5}
          className="rounded-full mt-1"
          style={{ backgroundColor: palette.badge }}
        >
          <Text size="b4" weight="medium" style={{ color: palette.text }}>
            {PRECIPITATION_TYPE_LABEL[forecast.precipitationType]}{' '}
            {forecast.precipitationProbability}%
          </Text>
        </Box>
      )}
    </VStack>
  );
}

function WeatherStats({ forecast }: { forecast: WeatherForecast }) {
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
      <Text size="b4" style={{ color: palette.textSub }}>
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

function HourlyForecastSection({ items }: { items: HourlyForecast[] }) {
  const palette = useTimePalette();

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="relative mt-16">
      <Image
        source={catImage}
        className="absolute right-5 w-[140px] h-[102px] z-10"
        style={{ top: -102 }}
        resizeMode="contain"
      />
      <VStack
        mx={20}
        py={16}
        px={16}
        gap={12}
        mb={12}
        className="rounded-lg border border-white/20 overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
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
    <VStack
      py={16}
      px={20}
      className="items-center justify-between rounded-lg"
      style={{ backgroundColor: palette.glassStrong, height: 120 }}
    >
      <Text size="e2" align="center" style={{ color: palette.textSub }}>
        {item.hour}시
      </Text>

      <SkyIcon
        width={24}
        height={24}
        color={item.skyCondition === 'CLEAR' ? palette.iconSun : palette.icon}
      />

      {item.precipitationProbability > 0 ? (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.precipitationProbability}%
        </Text>
      ) : (
        <View style={{ height: 14 }} />
      )}

      <Text size="b4" align="center" style={{ color: palette.textSub }}>
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
      className="rounded-lg border border-white/20 overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      <Text size="b3" weight="semibold" className="mb-1" style={{ color: palette.text }}>
        주간 예보
      </Text>
      {items.map((item) => {
        const Icon =
          resolveIconByPrecipitation(item.precipitationType) ?? resolveIconBySky(item.skyCondition);
        const dayLabel = formatDayLabel(item.date);
        const barLeft = ((item.temperatureMin - globalMin) / range) * 100;
        const barRight = ((globalMax - item.temperatureMax) / range) * 100;

        return (
          <HStack key={item.date} align="center" className="py-1 gap-3 px-1">
            <Text size="b3" className="w-8" style={{ color: palette.textSub }}>
              {dayLabel}
            </Text>

            <VStack align="center" className="w-10">
              <Icon width={20} height={20} color={palette.icon} />
              {item.precipitationProbability > 0 && (
                <Text size="e2" style={{ color: palette.accent }}>
                  {item.precipitationProbability}%
                </Text>
              )}
            </VStack>

            <Text size="b4" className="w-8 text-right" style={{ color: '#319CFC' }}>
              {Math.round(item.temperatureMin)}°
            </Text>
            <View
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
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
            <Text size="b4" className="w-8" style={{ color: '#F0503D' }}>
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
      className="rounded-lg border border-white/20 overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      <HStack gap={20} className="justify-center">
        {sunrise != null && (
          <VStack align="center" gap={4}>
            <Text size="b4" style={{ color: palette.textSub }}>
              일출
            </Text>
            <Text size="b1" weight="semibold" style={{ color: palette.text }}>
              {sunrise}
            </Text>
          </VStack>
        )}
        {sunset != null && (
          <VStack align="center" gap={4}>
            <Text size="b4" style={{ color: palette.textSub }}>
              일몰
            </Text>
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
      className="rounded-lg border border-white/20 overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
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
  if (temp >= 30) return '#F0503D';
  if (temp >= 25) return '#FF9500';
  if (temp >= 20) return '#F5C842';
  if (temp >= 15) return '#8BC34A';
  if (temp >= 10) return '#4FC3F7';
  if (temp >= 5) return '#319CFC';
  return '#2196F3';
}

function formatDayLabel(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'] as const;
  const d = new Date(dateStr);
  return days[d.getDay()] as string;
}

function ForecastSkeleton({ insetTop }: { insetTop: number }) {
  const palette = useTimePalette();

  return (
    <VStack p={16} gap={16} style={{ paddingTop: insetTop + 64 }}>
      <Skeleton className="h-60 w-full rounded-2xl" style={{ backgroundColor: palette.glass }} />
      <Skeleton
        className="h-[72px] w-full rounded-2xl"
        style={{ backgroundColor: palette.glass }}
      />
      <Skeleton
        className="h-[120px] w-full rounded-2xl"
        style={{ backgroundColor: palette.glass }}
      />
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

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 6 && h < 9) {
    return 'dawn';
  }
  if (h >= 9 && h < 17) {
    return 'day';
  }
  if (h >= 17 && h < 20) {
    return 'dusk';
  }
  return 'night';
}

function isKmaPreparationTime(): boolean {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return h < 2 || (h === 2 && m <= 15);
}
