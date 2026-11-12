import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import {
  formatClockTime,
  formatDateKeyLabel,
  formatHourLabel,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { formatRangeLabel } from '@src/shared/date/format/date-labels';
import { type Instant } from '@src/shared/date/instant';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { CalendarIcon } from '@src/shared/ui/icon';
import { cn } from '@src/shared/utils/cn';
import { usePrefetchQuery, useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { range, round, zip } from 'es-toolkit';
import { Accordion, PressableFeedback } from 'heroui-native';
import { memo, type PropsWithChildren, useMemo } from 'react';
import { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  PRECIPITATION_CHANCE_TEXT_CLASS,
  TODO_DOT_COLOR,
} from '../constants/weather-colors.constants';
import { VISIBLE_PRECIPITATION_CHANCE } from '../constants/weather.constants';
import { getTodayKey } from '../domains/weather-report.model';
import type { DailyForecastEntry } from '../domains/weather-report.model';
import { useLocationDateFormat } from '../hooks/use-location-date-format';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherSurface } from '../hooks/use-weather-surface';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { getTemperatureColor } from '../utils/temperature-color.view-model';
import {
  type TemperatureBar,
  toTemperatureBars,
  toTemperaturePosition,
} from '../utils/weather-bar.geometry';
import { getWeatherConditionLabelKey } from '../utils/weather-labels.view-model';
import {
  formatDegrees,
  formatTemperature,
  toDisplayTemperature,
} from '../utils/weather-temperature.view-model';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

/** 낮·밤 예보가 나누는 시각(WeatherKit daytimeForecast 07~19시) */
const DAYTIME_HOURS = { start: 7, end: 19 } as const;
/** 예보 일수. 할 일 점을 찍을 날 수와 로딩 행 수도 같다 */
const FORECAST_DAYS = 10;
const ICON_SIZE = 26;
const COLUMN_WIDTH = { day: 58, icon: 38, low: 46, high: 40 } as const;
const EXPAND_ENTERING = FadeInDown.duration(600)
  .easing(Easing.bezier(0.2, 0.8, 0.2, 1))
  .withInitialValues({ opacity: 0, translateY: 10 });
const ROW_LAYOUT = LinearTransition.duration(250);

interface RowFormat {
  dateFormat: DateFormatContext;
  timeFormat: TimeFormat;
  /** 글자 배율에 맞춰 고정 폭 열을 늘린다. */
  columnScale: number;
}

/** 할 일 조회가 실패해도 예보는 그대로 보이도록 할 일 점은 suspend하지 않고 점만 뺀다 */
export function DailyForecast() {
  const { t } = useTranslation(['weather', 'common']);
  const todayKey = useTodayKey();
  const completionsQuery = useGetDailyCompletionsQueryOptions({
    startDate: todayKey,
    endDate: addDaysToDateKey(todayKey, FORECAST_DAYS - 1),
  });
  usePrefetchQuery(completionsQuery);
  const [{ data: weather }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.daily },
      useGetPreferenceQueryOptions(),
    ],
  });
  const { data: completions } = useQuery(completionsQuery);
  const fontScaleRatio = useFontScaleRatio();
  const dateFormat = useLocationDateFormat(weather.location.timezone);
  const now = useMinuteNow();
  const forecastTodayKey = getTodayKey(weather, now);
  const bars = toTemperatureBars(weather.daily);
  const nowPosition = toTemperaturePosition(weather.daily, weather.current.temperature);
  const format = useMemo<RowFormat>(
    () => ({
      dateFormat: { locale: dateFormat.locale, timeZone: dateFormat.timeZone },
      timeFormat: preference.timeFormat,
      columnScale: fontScaleRatio,
    }),
    [dateFormat.locale, dateFormat.timeZone, preference.timeFormat, fontScaleRatio],
  );

  if (weather.daily.length === 0) {
    return <DailyForecast.Empty />;
  }

  return (
    <WeatherCard className="gap-0 pb-1.5">
      <DailyForecast.Header count={weather.daily.length} />
      <Accordion hideSeparator className="mt-2">
        {zip(weather.daily, bars).map(([day, bar]) => {
          const isToday = day.date === forecastTodayKey;
          return (
            <DailyForecast.Item
              key={day.date}
              day={day}
              bar={bar}
              nowPosition={isToday ? nowPosition : null}
              label={
                isToday
                  ? t('common:relativeDay.today')
                  : formatDateKeyLabel(day.date, 'weekday', format.dateFormat)
              }
              hasTodo={(completions?.[day.date]?.totalTodos ?? 0) > 0}
              format={format}
            />
          );
        })}
      </Accordion>
    </WeatherCard>
  );
}

DailyForecast.Header = function Header({ count }: { count: number }) {
  const { t } = useTranslation('weather');

  return (
    <HStack align="center" justify="between" gap={8}>
      <HStack align="center" gap={6} accessibilityRole="header" className="shrink">
        <CalendarIcon width={13} height={13} colorClassName="text-on-sky/[0.62]" />
        <Text size="b4" weight="medium" className="text-on-sky/[0.62]" numberOfLines={1}>
          {t('daily.title', { count })}
        </Text>
      </HStack>
      <HStack
        align="center"
        // oxlint-disable-next-line aido/spacing-scale -- 요일 아이콘과 글자 사이. 규격 단계 사이 5px을 쓴다
        gap={5}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Box className="size-1.5 rounded-full" style={{ backgroundColor: TODO_DOT_COLOR }} />
        <Text size="e1" weight="medium" className="text-on-sky/[0.62]" numberOfLines={1}>
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
  format: RowFormat;
}

DailyForecast.Item = memo(function Item({
  day,
  bar,
  label,
  nowPosition,
  hasTodo,
  format,
}: DailyForecastItemProps) {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const high = toDisplayTemperature(day.temperatureMax, unit);
  const low = toDisplayTemperature(day.temperatureMin, unit);
  const width = (column: keyof typeof COLUMN_WIDTH) => COLUMN_WIDTH[column] * format.columnScale;
  const description = t('daily.item', {
    day: label,
    condition: t(getWeatherConditionLabelKey(day.condition)),
    high,
    low,
    chance: day.precipitationChance,
  });
  const degrees = (celsius: number) => formatTemperature(celsius, unit);
  const clock = (date: Instant) => formatClockTime(date, format.timeFormat, format.dateFormat);
  const hour = (value: number) => formatHourLabel(value, format.timeFormat, format.dateFormat);
  const wind = day.windSpeedMax ?? day.windGustMax;

  return (
    <Accordion.Item
      value={day.date}
      layout={ROW_LAYOUT}
      className="border-t-[0.5px] border-on-sky/[0.16]"
    >
      <Accordion.Trigger asChild>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={
            hasTodo ? t('daily.itemWithTodo', { item: description }) : description
          }
          accessibilityHint={t('daily.expandHint')}
          className="min-h-14 flex-row items-center justify-start gap-0 p-0"
        >
          {/* oxlint-disable-next-line aido/spacing-scale -- 요일 아이콘과 글자 사이. 규격 단계 사이 5px을 쓴다 */}
          <HStack align="center" gap={5} style={{ width: width('day') }}>
            <Text size="b1" weight="medium" tone="onSky" numberOfLines={1} className="shrink">
              {label}
            </Text>
            {hasTodo && (
              <Box className="size-1.5 rounded-full" style={{ backgroundColor: TODO_DOT_COLOR }} />
            )}
          </HStack>
          <VStack align="center" style={{ width: width('icon') }}>
            <WeatherIcon
              condition={day.condition}
              isDaylight
              width={ICON_SIZE}
              height={ICON_SIZE}
            />
            {day.precipitationChance >= VISIBLE_PRECIPITATION_CHANCE && (
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
            numberOfLines={1}
            className="text-right text-on-sky/50 tabular-nums"
            style={{ width: width('low') }}
          >
            {formatDegrees(low)}
          </Text>
          <DailyForecast.TemperatureBar day={day} bar={bar} nowPosition={nowPosition} />
          <Text
            size="b1"
            weight="medium"
            tone="onSky"
            numberOfLines={1}
            className="text-right tabular-nums"
            style={{ width: width('high') }}
          >
            {formatDegrees(high)}
          </Text>
        </PressableFeedback>
      </Accordion.Trigger>

      <Accordion.Content
        animation={{ entering: { value: EXPAND_ENTERING } }}
        className="gap-2 px-0 pb-3.5 pt-0.5"
      >
        <HStack className="gap-2">
          {day.daytime != null && (
            <PartCard
              title={t('daily.daytime', {
                range: formatRangeLabel(
                  { start: hour(DAYTIME_HOURS.start), end: hour(DAYTIME_HOURS.end) },
                  'compact',
                  format.dateFormat,
                ),
              })}
              value={t('daily.dayPart', {
                condition: t(getWeatherConditionLabelKey(day.daytime.condition)),
                temperature: degrees(day.daytime.temperatureMax ?? day.temperatureMax),
              })}
            />
          )}
          {day.overnight != null && (
            <PartCard
              title={t('daily.overnight', {
                range: formatRangeLabel(
                  { start: hour(DAYTIME_HOURS.end), end: hour(DAYTIME_HOURS.start) },
                  'compact',
                  format.dateFormat,
                ),
              })}
              value={t('daily.nightPart', {
                condition: t(getWeatherConditionLabelKey(day.overnight.condition)),
                temperature: degrees(day.overnight.temperatureMin ?? day.temperatureMin),
              })}
            />
          )}
        </HStack>
        {/* 계약에 없는 값은 칸째 뺀다 */}
        <HStack className="flex-wrap gap-x-3 gap-y-1">
          <Fact>{t('daily.precipitation', { amount: round(day.precipitationAmount, 1) })}</Fact>
          <Fact>{t('daily.uvMax', { value: day.uvIndexMax })}</Fact>
          {wind != null && <Fact>{t('daily.windMax', { speed: round(wind, 1) })}</Fact>}
          {day.sunrise != null && day.sunset != null && (
            <Fact>
              {t('daily.sun', { sunrise: clock(day.sunrise), sunset: clock(day.sunset) })}
            </Fact>
          )}
        </HStack>
      </Accordion.Content>
    </Accordion.Item>
  );
});

/** 예보 기간 전체의 최저~최고 위에 하루의 범위를 기온 색 그라데이션으로 겹쳐 그린다. */
DailyForecast.TemperatureBar = function TemperatureBar({
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
          // oxlint-disable-next-line aido/no-arbitrary-spacing-class -- 현재 시각 점(size-[15px])의 가운데를 맞추는 절반 값이라 같은 토큰이 없다
          className="absolute -top-[5px] -ml-[7.5px] size-[15px] items-center justify-center rounded-full"
          style={{ left: `${nowPosition * 100}%`, backgroundColor: nowRing }}
        >
          <Box className="size-2.5 rounded-full bg-on-sky" />
        </Box>
      )}
    </Box>
  );
};

function Fact({ children }: PropsWithChildren) {
  return (
    <Text size="b4" className="min-w-[45%] flex-1 text-on-sky/[0.78] tabular-nums">
      {children}
    </Text>
  );
}

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
      {range(FORECAST_DAYS).map((index) => (
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
