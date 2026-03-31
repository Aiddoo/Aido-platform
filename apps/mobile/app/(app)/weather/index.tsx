import { ErrorCode } from '@aido/errors';
import catImage from '@assets/images/cat_weather_anchor.png';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import type { HourlyForecast, WeatherForecast } from '@src/features/weather/models/weather.model';
import { WeatherLocationPrompt } from '@src/features/weather/presentations/components/WeatherLocationPrompt';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
} from '@src/features/weather/presentations/components/weather-icon.resolver';
import { SKY_CONDITION_LABEL } from '@src/features/weather/presentations/constants/weather-labels.constant';
import { useGetForecastQueryOptions } from '@src/features/weather/presentations/queries/use-get-forecast-query-options';
import { isApiError } from '@src/shared/errors/api-error';
import { Box, HStack, Result, Text, VStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';
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
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
      >
        <ForecastHero forecast={forecast} />
        <ForecastStats forecast={forecast} />
        <View style={{ flex: 1 }} />
        <HourlyForecastStrip items={forecast.hourlyForecasts} />
      </ScrollView>
      <CatAnchor />
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
    <VStack align="center" gap={8} style={{ marginBottom: 40 }}>
      <Text style={[styles.heroTemp, { color: palette.text }]}>{avgTemp}</Text>

      <HStack gap={4} align="center">
        <Text size="e1" style={{ color: palette.textSub }}>
          최저
        </Text>
        <Text size="e1" weight="medium" style={{ color: '#319CFC' }}>
          {Math.round(forecast.temperatureMin)}°
        </Text>
        <Text size="e1" style={{ color: palette.textSub }}>
          {' '}
          / 최고
        </Text>
        <Text size="e1" weight="medium" style={{ color: '#F0503D' }}>
          {Math.round(forecast.temperatureMax)}°
        </Text>
      </HStack>

      <HStack gap={8} align="center" style={{ marginTop: 8 }}>
        <ForecastIcon width={18} height={18} color={palette.text} />
        <Text size="b3" weight="semibold" style={{ color: palette.text }}>
          {SKY_CONDITION_LABEL[forecast.skyCondition]}
        </Text>
      </HStack>
    </VStack>
  );
}

function ForecastStats({ forecast }: { forecast: WeatherForecast }) {
  const palette = usePalette();

  return (
    <HStack align="center" style={{ justifyContent: 'center', gap: 20, marginBottom: 20 }}>
      <StatItem label="바람" value={`${forecast.windSpeed} m/s`} palette={palette} />
      <View style={[styles.statDivider, { backgroundColor: palette.textSub }]} />
      <StatItem label="습도" value={`${forecast.humidity}%`} palette={palette} />
      <View style={[styles.statDivider, { backgroundColor: palette.textSub }]} />
      <StatItem
        label="강수확률"
        value={`${forecast.precipitationProbability}%`}
        palette={palette}
      />
    </HStack>
  );
}

function StatItem({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <VStack align="center" gap={4} style={{ width: 56 }}>
      <Text size="b4" style={{ color: palette.textSub }}>
        {label}
      </Text>
      <Text size="b1" weight="semibold" style={{ color: palette.text }}>
        {value}
      </Text>
    </VStack>
  );
}

function HourlyForecastStrip({ items }: { items: HourlyForecast[] }) {
  const cardStyle = useGlassStyle();

  if (items.length === 0) {
    return null;
  }

  return (
    <VStack mx={20} py={16} gap={12} mb={64} style={cardStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}
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
      py={16}
      px={20}
      gap={8}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.glassStrong,
        borderRadius: 8,
      }}
    >
      <Text size="e2" align="center" style={{ color: palette.textSub }}>
        {item.hour}시
      </Text>

      <SkyIcon width={24} height={24} color={palette.icon} />

      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {Math.round(item.temperature)}°
      </Text>

      {item.precipitationProbability > 0 && (
        <Text size="b4" align="center" style={{ color: palette.textSub }}>
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

function CatAnchor() {
  return <Image source={catImage} style={styles.catAnchor} resizeMode="contain" />;
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

function useGlassStyle() {
  return useMemo(
    () => ({
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(248,248,248,0.2)',
      overflow: 'hidden' as const,
    }),
    [],
  );
}

const PALETTES = {
  dawn: {
    bg: '#1B1464',
    gradient: ['#1B1464', '#7B5EA7', '#E8A87C'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    glass: 'rgba(20,0,50,0.20)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    accent: '#F5B078',
  },
  day: {
    bg: '#1976D2',
    gradient: ['#1976D2', '#42A5F5', '#90CAF9'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    glass: 'rgba(0,20,60,0.18)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    accent: '#FFFFFF',
  },
  dusk: {
    bg: '#281740',
    gradient: ['#281740', '#8B4A6B', '#CA6668'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',
    glass: 'rgba(15,5,30,0.22)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
    accent: '#FFB088',
  },
  night: {
    bg: '#080C1A',
    gradient: ['#080C1A', '#101D3A', '#1A3355'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.75)',
    icon: '#FFFFFF',
    glass: 'rgba(140,170,220,0.10)',
    glassStrong: 'rgba(245,245,245,0.10)',
    glassBorder: 'rgba(248,248,248,0.20)',
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
    fontSize: 80,
    lineHeight: 88,
    fontWeight: 'bold',
    letterSpacing: -2.4,
  },
  statDivider: {
    width: 1,
    height: 48,
    opacity: 0.3,
  },
  catAnchor: {
    position: 'absolute',
    right: 20,
    bottom: -4,
    width: 207,
    height: 151,
  },
});
