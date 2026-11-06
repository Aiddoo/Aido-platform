import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/get-daily-completions-query-options';
import {
  formatClockTime,
  formatDateKeyLabel,
  formatHourLabel,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/date-format';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { useFontScaleRatio } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { CalendarIcon } from '@src/shared/ui/icon';
import { cn } from '@src/shared/utils/cn';
import { usePrefetchQuery, useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { compact, range, round, zip } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { memo, useCallback, useMemo, useState } from 'react';
import Animated, { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PRECIPITATION_CHANCE_TEXT_CLASS, TODO_DOT_COLOR } from '../constants/weather-colors';
import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import { getTemperatureColor } from '../constants/weather-temperature-colors';
import { WeatherDailyPolicy } from '../domains/weather-daily.model';
import {
  type DailyForecastEntry,
  type TemperatureBar,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import { useLocationDateFormat } from '../hooks/use-location-date-format';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherSurface } from '../hooks/use-weather-surface';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

/** 이 확률 미만이면 강수 확률을 숨겨 아이콘 줄을 가볍게 둔다. */
const VISIBLE_CHANCE = 20;
/** 낮·밤 예보가 나누는 시각(WeatherKit daytimeForecast 07~19시) */
const DAYTIME_HOURS = { start: 7, end: 19 } as const;
/** 할 일 점을 찍을 날 수. 예보 일수와 같다. */
const TODO_DAYS = 10;
const LOADING_ROW_COUNT = 5;
const ICON_SIZE = 26;
const COLUMN_WIDTH = { day: 58, icon: 38, low: 46, high: 40 } as const;
const EXPAND_ENTERING = FadeInDown.duration(600)
  .easing(Easing.bezier(0.2, 0.8, 0.2, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
const ROW_LAYOUT = LinearTransition.duration(250);

interface RowFormat {
  dateFormat: DateFormatContext;
  timeFormat: TimeFormat;
  /** 글자 배율에 맞춰 고정 폭 열을 늘린다. */
  columnScale: number;
}

/**
 * 할 일 점은 날짜별 완료 현황(캘린더 표시와 같은 캐시)으로 찍는다. 리포트와 함께 받기 시작하되
 * 할 일 조회가 실패해도 예보는 그대로 보이도록 suspend하지 않고 점만 뺀다.
 */
export function DailyForecast() {
  const { t } = useTranslation('weather');
  const todayKey = useTodayKey();
  const completionsQuery = useGetDailyCompletionsQueryOptions({
    startDate: todayKey,
    endDate: addDaysToDateKey(todayKey, TODO_DAYS - 1),
  });
  usePrefetchQuery(completionsQuery);
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.daily },
      useGetPreferenceQueryOptions(),
    ],
  });
  const { data: completions } = useQuery(completionsQuery);
  const fontScaleRatio = useFontScaleRatio();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const toggle = useCallback(
    (date: string) => setExpandedDate((current) => (current === date ? null : date)),
    [],
  );
  const dateFormat = useLocationDateFormat(data.location.timezone);
  const now = useMinuteNow();
  const forecastTodayKey = WeatherReportPolicy.todayKey(data, now);
  const bars = WeatherReportPolicy.temperatureBars(data.daily);
  const nowPosition = WeatherDailyPolicy.temperaturePosition(data.daily, data.current.temperature);
  const format = useMemo<RowFormat>(
    () => ({
      dateFormat: { locale: dateFormat.locale, timeZone: dateFormat.timeZone },
      timeFormat: preference.timeFormat,
      columnScale: fontScaleRatio,
    }),
    [dateFormat.locale, dateFormat.timeZone, preference.timeFormat, fontScaleRatio],
  );

  if (data.daily.length === 0) {
    return <DailyForecast.Empty />;
  }

  return (
    <WeatherCard className="gap-0 pb-1.5">
      <DailyForecast.Header count={data.daily.length} />
      <VStack className="mt-2">
        {zip(data.daily, bars).map(([day, bar]) => {
          const isToday = day.date === forecastTodayKey;
          return (
            <DailyForecast.Item
              key={day.date}
              day={day}
              bar={bar}
              nowPosition={isToday ? nowPosition : null}
              label={
                isToday
                  ? t('daily.today')
                  : formatDateKeyLabel(day.date, 'weekday', format.dateFormat)
              }
              hasTodo={(completions?.[day.date]?.totalTodos ?? 0) > 0}
              isExpanded={expandedDate === day.date}
              onToggle={toggle}
              format={format}
            />
          );
        })}
      </VStack>
    </WeatherCard>
  );
}

DailyForecast.Header = function Header({ count }: { count: number }) {
  const { t } = useTranslation('weather');

  return (
    <HStack align="center" justify="between" gap={8}>
      <HStack align="center" gap={6} accessibilityRole="header" className="shrink">
        <CalendarIcon width={13} height={13} colorClassName="text-on-sky/[0.62]" />
        <Text size="b4" weight="medium" className="text-on-sky/[0.62]" maxLines={1}>
          {t('daily.title', { count })}
        </Text>
      </HStack>
      <HStack
        align="center"
        gap={5}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Box className="size-1.5 rounded-full" style={{ backgroundColor: TODO_DOT_COLOR }} />
        <Text size="e1" weight="medium" className="text-on-sky/[0.62]" maxLines={1}>
          {t('daily.todoDay')}
        </Text>
      </HStack>
    </HStack>
  );
};

interface DailyForecastItemProps {
  day: DailyForecastEntry;
  bar: TemperatureBar | undefined;
  label: string;
  /** 오늘 행에만 있는 지금 기온 점의 위치(0~1) */
  nowPosition: number | null;
  hasTodo: boolean;
  isExpanded: boolean;
  onToggle: (date: string) => void;
  format: RowFormat;
}

DailyForecast.Item = memo(function Item({
  day,
  bar,
  label,
  nowPosition,
  hasTodo,
  isExpanded,
  onToggle,
  format,
}: DailyForecastItemProps) {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const high = WeatherReportPolicy.displayTemperature(day.temperatureMax, unit);
  const low = WeatherReportPolicy.displayTemperature(day.temperatureMin, unit);
  const width = (column: keyof typeof COLUMN_WIDTH) => COLUMN_WIDTH[column] * format.columnScale;
  const description = t('daily.item', {
    day: label,
    condition: t(WEATHER_CONDITION_LABEL_KEYS[day.condition]),
    high,
    low,
    chance: day.precipitationChance,
  });

  return (
    <Animated.View layout={ROW_LAYOUT} className="border-t-[0.5px] border-on-sky/[0.16]">
      <PressableFeedback
        onPress={() => onToggle(day.date)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={hasTodo ? t('daily.itemWithTodo', { item: description }) : description}
        accessibilityHint={t('daily.expandHint')}
        className="min-h-14 flex-row items-center"
      >
        <HStack align="center" gap={5} style={{ width: width('day') }}>
          <Text size="b1" weight="medium" tone="onSky" maxLines={1} className="shrink">
            {label}
          </Text>
          {hasTodo && (
            <Box className="size-1.5 rounded-full" style={{ backgroundColor: TODO_DOT_COLOR }} />
          )}
        </HStack>
        <VStack align="center" style={{ width: width('icon') }}>
          <WeatherIcon condition={day.condition} isDaylight width={ICON_SIZE} height={ICON_SIZE} />
          {day.precipitationChance >= VISIBLE_CHANCE && (
            <Text
              size="e2"
              weight="semibold"
              className={cn('tabular-nums', PRECIPITATION_CHANCE_TEXT_CLASS)}
            >
              {t('details.percentValue', { value: day.precipitationChance })}
            </Text>
          )}
        </VStack>
        <Text
          size="b1"
          weight="medium"
          maxLines={1}
          className="text-right text-on-sky/50 tabular-nums"
          style={{ width: width('low') }}
        >
          {WeatherReportPolicy.degrees(low)}
        </Text>
        <DailyForecast.TemperatureBar day={day} bar={bar} nowPosition={nowPosition} />
        <Text
          size="b1"
          weight="medium"
          tone="onSky"
          maxLines={1}
          className="text-right tabular-nums"
          style={{ width: width('high') }}
        >
          {WeatherReportPolicy.degrees(high)}
        </Text>
      </PressableFeedback>
      {isExpanded && <DailyForecast.Details day={day} format={format} />}
    </Animated.View>
  );
});

/** 예보 기간 전체의 최저~최고 위에 하루의 범위를 기온 색 그라데이션으로 겹쳐 그린다. */
DailyForecast.TemperatureBar = function TemperatureBarTrack({
  day,
  bar,
  nowPosition,
}: {
  day: DailyForecastEntry;
  bar: TemperatureBar | undefined;
  nowPosition: number | null;
}) {
  const { nowRing } = useWeatherSurface();
  const gradientId = `daily-bar-${day.date}`;

  return (
    <Box flex={1} className="mx-3 h-[5px] min-w-9 rounded-full bg-black/[0.16]">
      {bar != null && (
        <Box
          className="absolute inset-y-0 min-w-[5px] overflow-hidden rounded-full"
          style={{ left: `${bar.start * 100}%`, right: `${(1 - bar.end) * 100}%` }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={getTemperatureColor(day.temperatureMin)} />
                <Stop offset="1" stopColor={getTemperatureColor(day.temperatureMax)} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </Box>
      )}
      {nowPosition != null && (
        <Box
          className="absolute -top-[5px] -ml-[7.5px] size-[15px] items-center justify-center rounded-full"
          style={{ left: `${nowPosition * 100}%`, backgroundColor: nowRing }}
        >
          <Box className="size-2.5 rounded-full bg-on-sky" />
        </Box>
      )}
    </Box>
  );
};

/** 펼친 날의 낮·밤 예보와 강수량·자외선·바람·해 시각. 계약에 없는 값은 칸째 뺀다. */
DailyForecast.Details = function Details({
  day,
  format,
}: {
  day: DailyForecastEntry;
  format: RowFormat;
}) {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const degrees = (celsius: number) =>
    WeatherReportPolicy.degrees(WeatherReportPolicy.displayTemperature(celsius, unit));
  const clock = (date: Date) => formatClockTime(date, format.timeFormat, format.dateFormat);
  const hour = (value: number) => formatHourLabel(value, format.timeFormat, format.dateFormat);
  const wind = day.windSpeedMax ?? day.windGustMax;
  const facts = compact([
    t('daily.precipitation', { amount: round(day.precipitationAmount, 1) }),
    t('daily.uvMax', { value: day.uvIndexMax }),
    wind == null ? null : t('daily.windMax', { speed: round(wind, 1) }),
    day.sunrise == null || day.sunset == null
      ? null
      : t('daily.sun', { sunrise: clock(day.sunrise), sunset: clock(day.sunset) }),
  ]);

  return (
    <Animated.View entering={EXPAND_ENTERING} className="gap-2 pb-3.5 pt-0.5">
      <HStack gap={8}>
        {day.daytime != null && (
          <PartCard
            title={t('daily.daytime', {
              start: hour(DAYTIME_HOURS.start),
              end: hour(DAYTIME_HOURS.end),
            })}
            value={t('daily.dayPart', {
              condition: t(WEATHER_CONDITION_LABEL_KEYS[day.daytime.condition]),
              temperature: degrees(day.daytime.temperatureMax ?? day.temperatureMax),
            })}
          />
        )}
        {day.overnight != null && (
          <PartCard
            title={t('daily.overnight', {
              start: hour(DAYTIME_HOURS.end),
              end: hour(DAYTIME_HOURS.start),
            })}
            value={t('daily.nightPart', {
              condition: t(WEATHER_CONDITION_LABEL_KEYS[day.overnight.condition]),
              temperature: degrees(day.overnight.temperatureMin ?? day.temperatureMin),
            })}
          />
        )}
      </HStack>
      <HStack className="flex-wrap gap-x-3 gap-y-1">
        {facts.map((fact) => (
          <Text key={fact} size="b4" className="min-w-[45%] flex-1 text-on-sky/[0.78] tabular-nums">
            {fact}
          </Text>
        ))}
      </HStack>
    </Animated.View>
  );
};

function PartCard({ title, value }: { title: string; value: string }) {
  return (
    <VStack flex={1} gap={2} className="rounded-[14px] bg-on-sky/[0.09] px-3 py-2.5">
      <Text size="e1" className="text-on-sky/60">
        {title}
      </Text>
      <Text size="b3" weight="semibold" tone="onSky">
        {value}
      </Text>
    </VStack>
  );
}

DailyForecast.Loading = function Loading() {
  return (
    <WeatherCard>
      <TextSkeleton size="b4" className="w-24 opacity-40" />
      {range(LOADING_ROW_COUNT).map((index) => (
        <HStack key={index} align="center" gap={10} className="min-h-14">
          <TextSkeleton size="b1" className="w-14 opacity-40" />
          <TextSkeleton size="b1" className="flex-1 opacity-40" />
        </HStack>
      ))}
    </WeatherCard>
  );
};

DailyForecast.Empty = function Empty() {
  return null;
};
