import type { WeatherPrecipitationType } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  formatClockTime,
  formatInstantHour,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { getMinutesUntil, type Instant } from '@src/shared/date/instant';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
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

import { NEXT_HOUR_CHART_COLORS } from '../constants/weather-colors.constants';
import {
  PRECIPITATION_LEVEL_LABEL_KEYS,
  PRECIPITATION_SUBJECT_LABEL_KEYS,
} from '../constants/weather-labels';
import {
  getPrecipitationWindow,
  type HourlyPrecipitationOutlook,
  isNowcastExpired,
  type PrecipitationPrecision,
  type PrecipitationWindow,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import type { MinuteForecast } from '../domains/weather-report.model';
import { useFormatLocalTime, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
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
const HOURLY_OUTLOOK_ICON_SIZE = 30;
const TITLE_ICON_SIZE = 13;
const GUIDE_LABEL_FONT_SIZE = 10;

/** 분 단위 예보가 없는 지역(국내 등)은 시간 단위 카드로 알리고, 6시간 넘게 낡은 데이터로는 안내하지 않는다 */
export function NextHourPrecipitation() {
  const { t } = useTranslation('weather');
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.precipitation },
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const toMessage = useFormatPrecipitationMessage({
    timeZone: data.location.timezone,
    timeFormat: preference.timeFormat,
    now,
  });

  if (isNowcastExpired(data, now)) {
    return <NextHourPrecipitation.Empty />;
  }
  if (data.nextHour == null) {
    const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(data.hourly, now);
    return outlook == null ? (
      <NextHourPrecipitation.Empty />
    ) : (
      <NextHourPrecipitation.HourlyOutlook
        outlook={outlook}
        timeZone={data.location.timezone}
        timeFormat={preference.timeFormat}
        now={now}
      />
    );
  }

  const window = getPrecipitationWindow(data, now);
  const { headline, detail } = toMessage(window);
  const summary = detail == null ? headline : t('nextHour.summary', { headline, detail });

  return (
    <WeatherCard
      title={t('nextHour.title')}
      icon={
        <WeatherRainIcon
          width={TITLE_ICON_SIZE}
          height={TITLE_ICON_SIZE}
          colorClassName="text-on-sky/[0.62]"
        />
      }
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
NextHourPrecipitation.HourlyOutlook = function HourlyOutlook({
  outlook,
  timeZone,
  timeFormat,
  now,
}: {
  outlook: HourlyPrecipitationOutlook;
  timeZone: string;
  timeFormat: TimeFormat;
  now: Instant;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useLocationDateFormat(timeZone);
  const localTime = useFormatLocalTime(timeZone, now);
  const iconSize = Math.round(HOURLY_OUTLOOK_ICON_SIZE * useFontScaleRatio());
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

/** viewBox를 같은 비율로 늘려 회전·창 크기 변경에도 다시 계산하지 않는다. 동작 줄이기에서는 바로 완성해 보인다 */
NextHourPrecipitation.Chart = function Chart({
  minutes,
  summary,
}: {
  minutes: MinuteForecast[];
  summary: string;
}) {
  const { t } = useTranslation('weather');
  const isReducedMotion = useIsReduceMotionEnabled();
  const chart = toNextHourChart(minutes);
  const guideColor = useResolvedColor('text-on-sky/22');
  const guideLabelColor = useResolvedColor('text-on-sky/50');
  const baselineColor = useResolvedColor('text-on-sky/35');
  const length = chart?.length ?? 0;
  const lineProgress = useSharedValue(isReducedMotion ? 1 : 0);
  const areaOpacity = useSharedValue(isReducedMotion ? 1 : 0);
  const { width, height, baseline } = NEXT_HOUR_CHART_SIZE;
  const hasChart = chart != null;

  // 그래프가 처음 나타날 때만 그린다. 재조회로 선만 바뀌면 지웠다 다시 그리지 않고 그대로 바꾼다
  useEffect(() => {
    if (!hasChart) {
      return;
    }
    if (isReducedMotion) {
      // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
      lineProgress.value = 1;
      // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
      areaOpacity.value = 1;
      return;
    }
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    lineProgress.value = 0;
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    areaOpacity.value = 0;
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    lineProgress.value = withTiming(1, { duration: DRAW_DURATION_MS, easing: LINE_EASING });
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    areaOpacity.value = withTiming(1, { duration: DRAW_DURATION_MS, easing: AREA_EASING });
    return () => {
      cancelAnimation(lineProgress);
      cancelAnimation(areaOpacity);
    };
  }, [hasChart, isReducedMotion, lineProgress, areaOpacity]);

  const lineProps = useAnimatedProps(() => ({
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    strokeDashoffset: length * (1 - lineProgress.value),
  }));
  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
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
            fontSize={GUIDE_LABEL_FONT_SIZE}
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

NextHourPrecipitation.Empty = function Empty() {
  return null;
};

interface PrecipitationMessage {
  headline: string;
  detail: string | null;
}

/** 시각은 위치 시간대로 말하고, 위치 벽시계가 기기와 다르면 '현지'를 붙인다 */
function useFormatPrecipitationMessage({
  timeZone,
  timeFormat,
  now,
}: {
  timeZone: string;
  timeFormat: TimeFormat;
  now: Instant;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useLocationDateFormat(timeZone);
  const localTime = useFormatLocalTime(timeZone, now);

  const formatMoment = (date: Instant, precision: PrecipitationPrecision) =>
    localTime(
      match(precision)
        .with('minute', () => formatClockTime(date, timeFormat, dateFormat))
        .with('hour', () => formatInstantHour(date, timeFormat, dateFormat))
        .exhaustive(),
    );

  /** 공급자가 형태 없이 강수라고만 알리면(null) 비와 눈을 함께 말한다. */
  const toSubject = (type: WeatherPrecipitationType | null) =>
    t(PRECIPITATION_SUBJECT_LABEL_KEYS[type ?? 'MIXED']);

  const formatEnd = (wet: Exclude<PrecipitationWindow, { kind: 'dry' }>) => {
    if (wet.endsAt == null) {
      return t('nextHour.continues');
    }
    const time = formatMoment(wet.endsAt, wet.endPrecision);
    return wet.isEndingOnLaterDay
      ? t('nextHour.endsAroundTomorrow', { time })
      : t('nextHour.endsAround', { time });
  };

  return (window: PrecipitationWindow): PrecipitationMessage =>
    match(window)
      .with({ kind: 'dry' }, () => ({ headline: t('nextHour.dry'), detail: null }))
      .with({ kind: 'ongoing' }, (wet) => ({
        headline: t('nextHour.ongoing', {
          subject: toSubject(wet.precipitationType),
        }),
        detail: formatEnd(wet),
      }))
      .with({ kind: 'upcoming', precision: 'minute' }, (wet) => ({
        headline: t('nextHour.startsInMinutes', {
          minutes: getMinutesUntil(wet.startsAt, now),
          subject: toSubject(wet.precipitationType),
        }),
        detail: formatEnd(wet),
      }))
      .with({ kind: 'upcoming', precision: 'hour' }, (wet) => ({
        headline: t('nextHour.startsAround', {
          time: formatMoment(wet.startsAt, 'hour'),
          subject: toSubject(wet.precipitationType),
        }),
        detail: formatEnd(wet),
      }))
      .exhaustive();
}
