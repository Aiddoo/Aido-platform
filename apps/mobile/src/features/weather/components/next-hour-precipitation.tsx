import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatInstantHour, type TimeFormat } from '@src/shared/date/date-format';
import { useFontScaleRatio } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { WeatherRainIcon } from '@src/shared/ui/icon';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Separator } from 'heroui-native';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { match } from 'ts-pattern';

import { NEXT_HOUR_CHART_COLORS } from '../constants/weather-colors';
import { PRECIPITATION_LEVEL_LABEL_KEYS } from '../constants/weather-labels';
import {
  type HourlyPrecipitationOutlook,
  WeatherNextHourPolicy,
} from '../domains/weather-next-hour.model';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import { useLocalTimeLabel, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useOnSkyColor } from '../hooks/use-on-sky-color';
import { usePrecipitationMessage } from '../hooks/use-precipitation-message';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import type { MinuteForecast } from '../schemas/weather-report.schema';
import { NEXT_HOUR_CHART_SIZE, toNextHourChart } from '../utils/next-hour-chart.geometry';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TICK_MINUTES = range(0, 61, 10);
const DRAW_DURATION_MS = 1200;
const LINE_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);
const AREA_EASING = Easing.out(Easing.ease);
const LABEL_FONT = 'WantedSans-Medium';
const AREA_GRADIENT_ID = 'next-hour-area';
const FALLBACK_ICON_SIZE = 30;

/**
 * 분 단위 예보가 있으면 그래프로, 없는 지역(국내 등)은 시간 단위 한 줄 카드로 알린다. 비 소식이 없으면 카드를 만들지 않는다.
 * 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비를 안내하지 않는다.
 */
export function NextHourPrecipitation() {
  const { t } = useTranslation('weather');
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.precipitation },
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const toMessage = usePrecipitationMessage({
    timeZone: data.location.timezone,
    timeFormat: preference.timeFormat,
    now,
  });

  if (WeatherReportPolicy.isNowcastExpired(data, now)) {
    return <NextHourPrecipitation.Empty />;
  }
  if (data.nextHour == null) {
    const outlook = WeatherNextHourPolicy.getHourlyPrecipitationOutlook(data.hourly, now);
    return outlook == null ? (
      <NextHourPrecipitation.Empty />
    ) : (
      <NextHourPrecipitation.HourlyFallback
        outlook={outlook}
        timeZone={data.location.timezone}
        timeFormat={preference.timeFormat}
        now={now}
      />
    );
  }

  const window = WeatherReportPolicy.getPrecipitationWindow(data, now);
  const { headline, detail } = toMessage(window);
  const summary = detail == null ? headline : t('nextHour.summary', { headline, detail });

  return (
    <WeatherCard
      title={t('nextHour.title')}
      icon={<WeatherRainIcon width={13} height={13} colorClassName="text-on-sky/[0.62]" />}
      className="gap-0 pb-3"
    >
      <VStack gap={2} className="mt-1.5">
        <Text size="b1" weight="semibold" tone="onSky">
          {headline}
        </Text>
        {detail != null && (
          <Text size="b4" className="text-on-sky/[0.78]">
            {detail}
          </Text>
        )}
      </VStack>
      <Separator thickness={0.5} className="mt-3 bg-on-sky/[0.18]" />
      <NextHourPrecipitation.Chart minutes={data.nextHour.minutes} summary={summary} />
    </WeatherCard>
  );
}

/** 분 단위 예보가 없는 지역(국내 등)은 그래프 대신 6시간 안에 비가 오는 첫 시간을 한 줄로 알린다. */
NextHourPrecipitation.HourlyFallback = function HourlyFallback({
  outlook,
  timeZone,
  timeFormat,
  now,
}: {
  outlook: HourlyPrecipitationOutlook;
  timeZone: string;
  timeFormat: TimeFormat;
  now: Date;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useLocationDateFormat(timeZone);
  const localTime = useLocalTimeLabel(timeZone, now);
  const iconSize = Math.round(FALLBACK_ICON_SIZE * useFontScaleRatio());
  const { hour, isOngoing } = outlook;
  const isSnow = WeatherReportPolicy.isFrozenPrecipitation(hour.precipitationType);
  const chance = hour.precipitationChance;
  const time = localTime(formatInstantHour(hour.startsAt, timeFormat, dateFormat));
  const title = match({ isOngoing, isSnow })
    .with({ isOngoing: true, isSnow: true }, () => t('nextHour.fallback.snowNow', { chance }))
    .with({ isOngoing: true, isSnow: false }, () => t('nextHour.fallback.rainNow', { chance }))
    .with({ isOngoing: false, isSnow: true }, () => t('nextHour.fallback.snow', { time, chance }))
    .with({ isOngoing: false, isSnow: false }, () => t('nextHour.fallback.rain', { time, chance }))
    .exhaustive();
  const subtitle = t('nextHour.fallback.hourlyOnly');

  return (
    <WeatherCard>
      <HStack
        gap={12}
        align="center"
        accessible
        accessibilityLabel={t('nextHour.fallback.label', { title, subtitle })}
      >
        <WeatherIcon
          condition={isSnow ? 'SNOW' : 'RAIN'}
          isDaylight={hour.isDaylight}
          width={iconSize}
          height={iconSize}
        />
        <VStack flex={1} gap={2}>
          <Text
            size="b2"
            weight="semibold"
            tone="onSky"
            className="leading-[22px] tracking-[-0.3px]"
          >
            {title}
          </Text>
          <Text size="b4" className="leading-[18px] text-on-sky/75">
            {subtitle}
          </Text>
        </VStack>
      </HStack>
    </WeatherCard>
  );
};

/**
 * 부모 폭에 맞춰 viewBox를 같은 비율로 늘리므로 회전·창 크기 변경에도 다시 계산할 것이 없다.
 * 선은 왼쪽부터 그려지고 면은 함께 서서히 나타난다. 동작 줄이기에서는 완성된 그래프를 바로 보인다.
 */
NextHourPrecipitation.Chart = function Chart({
  minutes,
  summary,
}: {
  minutes: MinuteForecast[];
  summary: string;
}) {
  const { t } = useTranslation('weather');
  const isReducedMotion = useReduceMotion();
  const chart = toNextHourChart(minutes);
  const guideColor = useOnSkyColor('text-on-sky/22');
  const guideLabelColor = useOnSkyColor('text-on-sky/50');
  const baselineColor = useOnSkyColor('text-on-sky/35');
  const length = chart?.length ?? 0;
  const lineProgress = useSharedValue(isReducedMotion ? 1 : 0);
  const areaOpacity = useSharedValue(isReducedMotion ? 1 : 0);
  const { width, height, baseline } = NEXT_HOUR_CHART_SIZE;

  useEffect(() => {
    if (isReducedMotion) {
      lineProgress.value = 1;
      areaOpacity.value = 1;
      return;
    }
    lineProgress.value = 0;
    areaOpacity.value = 0;
    lineProgress.value = withTiming(1, { duration: DRAW_DURATION_MS, easing: LINE_EASING });
    areaOpacity.value = withTiming(1, { duration: DRAW_DURATION_MS, easing: AREA_EASING });
    return () => {
      cancelAnimation(lineProgress);
      cancelAnimation(areaOpacity);
    };
  }, [chart?.line, isReducedMotion, lineProgress, areaOpacity]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - lineProgress.value),
  }));
  const areaProps = useAnimatedProps(() => ({ opacity: areaOpacity.value }));

  if (chart == null) {
    return null;
  }

  return (
    <VStack
      className="mt-2.5"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('nextHour.chartLabel', { summary })}
    >
      <Svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: width / height }}>
        <Defs>
          <LinearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NEXT_HOUR_CHART_COLORS.area} stopOpacity={0.75} />
            <Stop offset="1" stopColor={NEXT_HOUR_CHART_COLORS.area} stopOpacity={0.08} />
          </LinearGradient>
        </Defs>
        {chart.guides.map((guide) => (
          <Line
            key={guide.level}
            x1={0}
            x2={width}
            y1={guide.y}
            y2={guide.y}
            stroke={guideColor}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
        {chart.guides.map((guide) => (
          <SvgText
            key={`${guide.level}-label`}
            x={width}
            y={guide.y - 4}
            textAnchor="end"
            fill={guideLabelColor}
            fontSize={10}
            fontFamily={LABEL_FONT}
          >
            {t(PRECIPITATION_LEVEL_LABEL_KEYS[guide.level])}
          </SvgText>
        ))}
        <Line
          x1={0}
          x2={width}
          y1={baseline}
          y2={baseline}
          stroke={baselineColor}
          strokeWidth={1}
        />
        <AnimatedPath d={chart.area} fill={`url(#${AREA_GRADIENT_ID})`} animatedProps={areaProps} />
        <AnimatedPath
          d={chart.line}
          fill="none"
          stroke={NEXT_HOUR_CHART_COLORS.line}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={length}
          animatedProps={lineProps}
        />
      </Svg>
      <HStack justify="between" className="mt-1.5">
        {TICK_MINUTES.map((minute) => (
          <Text key={minute} size="e1" weight="medium" className="text-on-sky/[0.62] tabular-nums">
            {minute === 0 ? t('nextHour.now') : t('nextHour.minutesLater', { minutes: minute })}
          </Text>
        ))}
      </HStack>
    </VStack>
  );
};

/** 분 단위 예보가 없는 지역이 많아 카드 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */
NextHourPrecipitation.Loading = function Loading() {
  return null;
};

NextHourPrecipitation.Empty = function Empty() {
  return null;
};
