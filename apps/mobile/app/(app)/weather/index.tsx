import { ErrorCode } from '@aido/errors';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import type { HourlyForecast, WeatherForecast } from '@src/features/weather/models/weather.model';
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
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { Box, HStack, Result, Text, VStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export default function WeatherDetailScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [selectedDate] = useFeedDate();
  const {
    data: forecast,
    error,
    isPending,
  } = useQuery(useGetForecastQueryOptions(formatDate(selectedDate)));

  if (isPending) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <GradientBackground palette={palette} />
        <ForecastSkeleton palette={palette} insetTop={insets.top} />
      </View>
    );
  }

  if (error) {
    if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)) {
      return (
        <View style={[styles.container, { backgroundColor: palette.bg }]}>
          <GradientBackground palette={palette} />
          <Box p={16} style={{ marginTop: 100 }}>
            <WeatherLocationPrompt />
          </Box>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <GradientBackground palette={palette} />
        <Result title="날씨 정보를 불러올 수 없어요" description="잠시 후 다시 시도해주세요" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <GradientBackground palette={palette} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 40,
          gap: 20,
        }}
      >
        <ForecastHero forecast={forecast} />
        <ForecastStats forecast={forecast} />
        <HourlyForecastStrip items={forecast.hourlyForecasts} />
      </ScrollView>
    </View>
  );
}

function ForecastHero({ forecast }: { forecast: WeatherForecast }) {
  const palette = usePalette();
  const ForecastIcon =
    resolveIconByPrecipitation(forecast.precipitationType) ??
    resolveIconBySky(forecast.skyCondition);
  const avgTemp = Math.round((forecast.temperatureMin + forecast.temperatureMax) / 2);

  return (
    <VStack align="center" gap={8} px={16}>
      <ForecastIcon width={100} height={100} color={palette.icon} />

      <Text style={[styles.heroTemp, { color: palette.text }]}>{avgTemp}°</Text>

      <Text size="b2" style={{ color: palette.textSub }}>
        최저 {Math.round(forecast.temperatureMin)}° / 최고 {Math.round(forecast.temperatureMax)}°
      </Text>

      <Text size="t3" weight="medium" style={{ color: palette.text }}>
        {SKY_CONDITION_LABEL[forecast.skyCondition]}
      </Text>

      {WeatherPolicy.shouldShowPrecipitation(forecast) && (
        <Box px={14} py={5} style={[styles.badge, { backgroundColor: palette.badge }]}>
          <Text size="b4" weight="medium" style={{ color: palette.text }}>
            {PRECIPITATION_TYPE_LABEL[forecast.precipitationType]}{' '}
            {forecast.precipitationProbability}%
          </Text>
        </Box>
      )}
    </VStack>
  );
}

function ForecastStats({ forecast }: { forecast: WeatherForecast }) {
  return (
    <HStack mx={16} gap={10}>
      <StatCard label="바람" value={`${forecast.windSpeed}m/s`} />
      <StatCard label="습도" value={`${forecast.humidity}%`} />
      <StatCard label="강수확률" value={`${forecast.precipitationProbability}%`} />
    </HStack>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  const cardStyle = useGlassStyle(palette);

  return (
    <VStack flex={1} py={14} align="center" gap={6} style={cardStyle}>
      <Text size="e1" style={{ color: palette.textSub }}>
        {label}
      </Text>

      <Text size="b2" weight="bold" style={{ color: palette.text }}>
        {value}
      </Text>
    </VStack>
  );
}

function HourlyForecastStrip({ items }: { items: HourlyForecast[] }) {
  const palette = usePalette();
  const cardStyle = useGlassStyle(palette);

  if (items.length === 0) {
    return null;
  }

  return (
    <VStack mx={16} py={16} gap={12} style={cardStyle}>
      <Text size="b3" weight="semibold" style={{ color: palette.text, paddingHorizontal: 16 }}>
        시간별 예보
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {items.map((item) => (
          <HourlyCard key={item.hour} item={item} />
        ))}
      </ScrollView>
    </VStack>
  );
}

function HourlyCard({ item }: { item: HourlyForecast }) {
  const palette = usePalette();
  const SkyIcon = resolveIconBySky(item.skyCondition);

  return (
    <VStack
      py={10}
      px={8}
      gap={5}
      className="rounded-xl"
      style={{
        width: 74,
        alignItems: 'center',
        backgroundColor: palette.glassStrong,
      }}
    >
      <Text size="e2" align="center" style={{ color: palette.textSub }}>
        {item.hour}시
      </Text>

      <SkyIcon width={22} height={22} color={palette.icon} />

      <Text size="b4" weight="semibold" align="center" style={{ color: palette.text }}>
        {Math.round(item.temperature)}°
      </Text>

      {item.precipitationProbability > 0 && (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.precipitationProbability}%
        </Text>
      )}

      {item.precipitationAmount > 0 && (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.precipitationAmount}mm
        </Text>
      )}

      {item.snowAmount > 0 && (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.snowAmount}cm
        </Text>
      )}
    </VStack>
  );
}

function ForecastSkeleton({ palette, insetTop }: { palette: Palette; insetTop: number }) {
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

function GradientBackground({ palette }: { palette: Palette }) {
  const { width, height } = Dimensions.get('window');

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={palette.gradient[0]} />
          <Stop offset="0.5" stopColor={palette.gradient[1]} />
          <Stop offset="1" stopColor={palette.gradient[2]} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#bg)" />
    </Svg>
  );
}

function usePalette(): Palette {
  return PALETTES[getTimeOfDay()];
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

function useGlassStyle(palette: Palette) {
  return useMemo(
    () => ({
      backgroundColor: palette.glass,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.glassBorder,
    }),
    [palette],
  );
}

const PALETTES = {
  dawn: {
    bg: '#1B1464',
    gradient: ['#1B1464', '#7B5EA7', '#E8A87C'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.80)',
    icon: '#FFFFFF',
    glass: 'rgba(20,0,50,0.20)',
    glassStrong: 'rgba(20,0,50,0.28)',
    glassBorder: 'rgba(255,255,255,0.12)',
    badge: 'rgba(20,0,50,0.25)',
    accent: '#F5B078',
  },
  day: {
    bg: '#1976D2',
    gradient: ['#1976D2', '#42A5F5', '#90CAF9'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    glass: 'rgba(0,20,60,0.18)',
    glassStrong: 'rgba(0,20,60,0.26)',
    glassBorder: 'rgba(255,255,255,0.18)',
    badge: 'rgba(0,20,60,0.22)',
    accent: '#FFFFFF',
  },
  dusk: {
    bg: '#1A1033',
    gradient: ['#1A1033', '#6B3A7D', '#E87461'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.78)',
    icon: '#FFFFFF',
    glass: 'rgba(15,5,30,0.22)',
    glassStrong: 'rgba(15,5,30,0.30)',
    glassBorder: 'rgba(255,255,255,0.10)',
    badge: 'rgba(15,5,30,0.25)',
    accent: '#FFB088',
  },
  night: {
    bg: '#080C1A',
    gradient: ['#080C1A', '#101D3A', '#1A3355'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.75)',
    icon: '#FFFFFF',
    glass: 'rgba(140,170,220,0.10)',
    glassStrong: 'rgba(140,170,220,0.16)',
    glassBorder: 'rgba(140,170,220,0.14)',
    badge: 'rgba(140,170,220,0.20)',
    accent: '#7DB4F5',
  },
} as const;

type TimeOfDay = keyof typeof PALETTES;
type Palette = (typeof PALETTES)[TimeOfDay];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroTemp: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: 'bold',
  },
  badge: {
    borderRadius: 999,
    marginTop: 4,
  },
});
