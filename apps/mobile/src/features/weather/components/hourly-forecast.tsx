import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  formatClockTime,
  formatInstantHour,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { Box, Spacing, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Separator } from 'heroui-native';
import type { TFunction } from 'i18next';
import { memo, type ReactNode } from 'react';
import { FlatList } from 'react-native';
import { match } from 'ts-pattern';

import { PRECIPITATION_CHANCE_TEXT_CLASS } from '../constants/weather-colors.constants';
import { VISIBLE_PRECIPITATION_CHANCE } from '../constants/weather.constants';
import type { HourlySky, HourlySummary } from '../domains/weather-hourly.model';
import type { HourlyForecastEntry, WeatherReport } from '../domains/weather-report.model';
import { useFormatLocalTime, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import {
  type HourlyTimelineItem,
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/weather.queries';
import {
  getPrecipitationSubjectLabelKey,
  getWeatherConditionLabelKey,
} from '../utils/weather-labels.view-model';
import {
  formatDegrees,
  formatTemperature,
  type TemperatureUnit,
  toDisplayTemperature,
} from '../utils/weather-temperature.view-model';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

const SKY_BEFORE_KEYS = {
  clear: 'hourly.summary.skyBefore.clear',
  partlyCloudy: 'hourly.summary.skyBefore.partlyCloudy',
  cloudy: 'hourly.summary.skyBefore.cloudy',
  hazy: 'hourly.summary.skyBefore.hazy',
} as const satisfies Record<HourlySky, string>;

const SKY_AFTER_KEYS = {
  clear: 'hourly.summary.skyAfter.clear',
  partlyCloudy: 'hourly.summary.skyAfter.partlyCloudy',
  cloudy: 'hourly.summary.skyAfter.cloudy',
  hazy: 'hourly.summary.skyAfter.hazy',
} as const satisfies Record<HourlySky, string>;

const SKY_STEADY_KEYS = {
  clear: 'hourly.summary.steady.clear',
  partlyCloudy: 'hourly.summary.steady.partlyCloudy',
  cloudy: 'hourly.summary.steady.cloudy',
  hazy: 'hourly.summary.steady.hazy',
} as const satisfies Record<HourlySky, string>;

/** 12시간제는 "오후 10시"가 15pt 그대로 들어가도록 넓히고, 글자 배율에 비례해 늘린다 */
const CELL_WIDTH = { TWELVE_HOUR: 70, TWENTY_FOUR_HOUR: 58 } as const satisfies Record<
  TimeFormat,
  number
>;
const ICON_SIZE = 28;
/** 아이콘 아래에 강수 확률 줄까지 포함한 칸 높이. 확률이 없는 칸도 같은 높이를 차지한다. */
const CELL_ICON_HEIGHT = 50;
const INITIAL_RENDER_COUNT = 8;
/** 칸 줄 좌우 여백. getItemLayout의 칸 위치에도 더한다 */
const TIMELINE_INSET = 6;
const TIMELINE_CONTENT_STYLE = { paddingHorizontal: TIMELINE_INSET };
const LOADING_CELL_COUNT = 6;
/** 시안 온도 줄 19/24 -0.4. 맞는 토큰이 없어 앱 글자 크기 비율만 곱한다. */
const VALUE_TYPE = { fontSize: 19, lineHeight: 24, letterSpacing: -0.4 };

interface HourlyValueText {
  style: typeof VALUE_TYPE;
  minimumFontScale: number;
}

function useHourlyValueTextStyle(): HourlyValueText {
  const ratio = useFontScaleRatio();
  const minimumFontScale = useMinimumFontScale(VALUE_TYPE.fontSize);
  return {
    style: {
      ...VALUE_TYPE,
      fontSize: VALUE_TYPE.fontSize * ratio,
      lineHeight: VALUE_TYPE.lineHeight * ratio,
    },
    minimumFontScale,
  };
}

/** 칸이 부르던 번역·단위·글자 배율 훅을 부모가 한 번 불러 넘긴다 */
interface TimelineContext {
  t: TFunction<'weather'>;
  unit: TemperatureUnit;
  dateFormat: DateFormatContext;
  timeFormat: TimeFormat;
  labelMinimumFontScale: number;
  valueText: HourlyValueText;
}

function getTimelineKey(item: HourlyTimelineItem): string {
  return item.kind === 'hour'
    ? String(toEpochMs(item.hour.startsAt))
    : `${item.kind}-${toEpochMs(item.at)}`;
}

/** 칸 목록은 분마다 select로 다시 고르지만 같으면 구조 공유로 앞의 참조를 돌려줘 칸이 시간이 바뀔 때만 다시 그려진다 */
export function HourlyForecast() {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();

  // select가 지금 시각으로 칸을 고르므로 조회보다 먼저 읽는다
  const now = useMinuteNow();
  const [{ data: weather }, { data: preference }] = useSuspenseQueries({
    queries: [
      {
        ...useGetWeatherReportQueryOptions(),
        select: (report: WeatherReport) => WeatherReportSelect.hourly(report, now),
      },
      useGetPreferenceQueryOptions(),
    ],
  });

  const fontScaleRatio = useFontScaleRatio();
  const labelMinimumFontScale = useMinimumFontScale('b3');
  const valueText = useHourlyValueTextStyle();
  const dateFormat = useLocationDateFormat(weather.location.timezone);

  const { timeline, summary } = weather;
  const cellWidth = CELL_WIDTH[preference.timeFormat] * fontScaleRatio;
  const context: TimelineContext = {
    t,
    unit,
    dateFormat,
    timeFormat: preference.timeFormat,
    labelMinimumFontScale,
    valueText,
  };

  if (timeline.length === 0) {
    return <HourlyForecast.Empty />;
  }

  return (
    <Box>
      <WeatherCard className="gap-0 px-0 py-3.5">
        {summary != null && (
          <>
            <HourlyForecast.Summary summary={summary} context={context} now={now} />
            <Separator thickness={0.5} className="mx-4 mt-3 bg-on-sky/[0.18]" />
          </>
        )}
        <FlatList
          horizontal
          data={timeline}
          keyExtractor={getTimelineKey}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={INITIAL_RENDER_COUNT}
          getItemLayout={(_, index) => ({
            length: cellWidth,
            offset: TIMELINE_INSET + cellWidth * index,
            index,
          })}
          className="mt-3"
          contentContainerStyle={TIMELINE_CONTENT_STYLE}
          renderItem={({ item }) => (
            <HourlyForecast.Item item={item} width={cellWidth} context={context} />
          )}
        />
      </WeatherCard>
    </Box>
  );
}

/** 문장 속 시각은 위치 벽시계가 기기와 다를 때만 '현지'를 붙인다. 칸마다 붙이면 좁은 칸이 넘쳐 문장에서만 밝힌다. */
HourlyForecast.Summary = function Summary({
  summary,
  context: { t, unit, dateFormat, timeFormat },
  now,
}: {
  summary: HourlySummary;
  context: TimelineContext;
  now: Instant;
}) {
  const localTime = useFormatLocalTime(dateFormat.timeZone, now);
  const hourLabel = (date: Instant) => localTime(formatInstantHour(date, timeFormat, dateFormat));

  const sentence = match(summary)
    .with({ kind: 'precipitationOngoing' }, ({ precipitationType, endsAt, isEndingOnLaterDay }) => {
      const subject = t(getPrecipitationSubjectLabelKey(precipitationType));
      if (endsAt == null) {
        return t('hourly.summary.ongoingAllDay', { subject });
      }
      const time = hourLabel(endsAt);
      return isEndingOnLaterDay
        ? t('hourly.summary.ongoingTomorrow', { subject, time })
        : t('hourly.summary.ongoing', { subject, time });
    })
    .with({ kind: 'precipitationUpcoming' }, (upcoming) => {
      const params = {
        subject: t(getPrecipitationSubjectLabelKey(upcoming.precipitationType)),
        time: hourLabel(upcoming.startsAt),
        sky: t(SKY_BEFORE_KEYS[upcoming.skyBefore]),
      };
      return upcoming.isStartingOnLaterDay
        ? t('hourly.summary.upcomingTomorrow', params)
        : t('hourly.summary.upcoming', params);
    })
    .with({ kind: 'skyChange' }, (change) => {
      const params = {
        time: hourLabel(change.changesAt),
        from: t(SKY_BEFORE_KEYS[change.from]),
        to: t(SKY_AFTER_KEYS[change.to]),
      };
      return change.isChangingOnLaterDay
        ? t('hourly.summary.skyChangeTomorrow', params)
        : t('hourly.summary.skyChange', params);
    })
    .with({ kind: 'steady' }, ({ sky, peak }) => {
      if (peak == null) {
        return t(SKY_STEADY_KEYS[sky]);
      }
      const params = {
        sky: t(SKY_BEFORE_KEYS[sky]),
        time: hourLabel(peak.at),
        temperature: formatTemperature(peak.temperature, unit),
      };
      return peak.extreme === 'highest'
        ? t('hourly.summary.highest', params)
        : t('hourly.summary.lowest', params);
    })
    .exhaustive();

  return (
    <Text size="b3" weight="medium" tone="onSky" className="mx-4 leading-[22px]">
      {sentence}
    </Text>
  );
};

interface HourlyForecastItemProps {
  item: HourlyTimelineItem;
  width: number;
  context: TimelineContext;
}

HourlyForecast.Item = memo(function Item({ item, width, context }: HourlyForecastItemProps) {
  return item.kind === 'hour' ? (
    <HourCell hour={item.hour} isNow={item.isNow} width={width} context={context} />
  ) : (
    <SunCell kind={item.kind} at={item.at} width={width} context={context} />
  );
});

function HourCell({
  hour,
  isNow,
  width,
  context: { t, unit, dateFormat, timeFormat, labelMinimumFontScale, valueText },
}: {
  hour: HourlyForecastEntry;
  isNow: boolean;
  width: number;
  context: TimelineContext;
}) {
  const time = isNow ? t('hourly.now') : formatInstantHour(hour.startsAt, timeFormat, dateFormat);
  const temperature = toDisplayTemperature(hour.temperature, unit);
  const isChanceVisible = hour.precipitationChance >= VISIBLE_PRECIPITATION_CHANCE;

  return (
    <VStack
      align="center"
      style={{ width }}
      accessible
      accessibilityLabel={t('hourly.item', {
        time,
        temperature,
        condition: t(getWeatherConditionLabelKey(hour.condition)),
        chance: hour.precipitationChance,
      })}
    >
      <Text
        size="b3"
        weight={isNow ? 'semibold' : 'medium'}
        tone="onSky"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={labelMinimumFontScale}
        className="tabular-nums"
      >
        {time}
      </Text>
      <CellIcon
        chance={
          isChanceVisible ? t('details.percentValue', { value: hour.precipitationChance }) : null
        }
      >
        <WeatherIcon
          condition={hour.condition}
          isDaylight={hour.isDaylight}
          width={ICON_SIZE}
          height={ICON_SIZE}
        />
      </CellIcon>
      <Text
        size="b1"
        weight="medium"
        tone="onSky"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={valueText.minimumFontScale}
        className="tabular-nums"
        style={valueText.style}
      >
        {formatDegrees(temperature)}
      </Text>
    </VStack>
  );
}

function SunCell({
  kind,
  at,
  width,
  context: { t, dateFormat, timeFormat, labelMinimumFontScale, valueText },
}: {
  kind: 'sunrise' | 'sunset';
  at: Instant;
  width: number;
  context: TimelineContext;
}) {
  const time = formatClockTime(at, timeFormat, dateFormat);
  const event = kind === 'sunrise' ? t('hourly.sunrise') : t('hourly.sunset');
  const Icon = kind === 'sunrise' ? WeatherIcon.Sunrise : WeatherIcon.Sunset;

  return (
    <VStack
      align="center"
      style={{ width }}
      accessible
      accessibilityLabel={t('hourly.sunItem', { time, event })}
    >
      <Text
        size="b3"
        weight="medium"
        tone="onSky"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={labelMinimumFontScale}
        className="tabular-nums"
      >
        {time}
      </Text>
      <CellIcon chance={null}>
        <Icon width={ICON_SIZE} height={ICON_SIZE} />
      </CellIcon>
      <Text
        size="b1"
        weight="medium"
        tone="onSky"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={valueText.minimumFontScale}
        style={valueText.style}
      >
        {event}
      </Text>
    </VStack>
  );
}

/** 강수 확률이 없는 칸도 같은 높이를 차지해 온도 줄이 칸마다 어긋나지 않는다. */
function CellIcon({ chance, children }: { chance: string | null; children: ReactNode }) {
  return (
    <VStack align="center" justify="center" style={{ height: CELL_ICON_HEIGHT }}>
      {children}
      <Text
        size="e1"
        weight="semibold"
        className={cn('min-h-[14px] tabular-nums', PRECIPITATION_CHANCE_TEXT_CLASS)}
      >
        {chance ?? ''}
      </Text>
    </VStack>
  );
}

HourlyForecast.Loading = function Loading() {
  return (
    <WeatherCard className="gap-0 px-0 py-3.5">
      <TextSkeleton size="b3" className="mx-4 w-48 opacity-40" />
      <Separator thickness={0.5} className="mx-4 mt-3 bg-on-sky/[0.18]" />
      <Box className="mt-3 flex-row px-1.5">
        {range(LOADING_CELL_COUNT).map((index) => (
          <VStack key={index} align="center" style={{ width: CELL_WIDTH.TWENTY_FOUR_HOUR }}>
            <TextSkeleton size="b3" className="w-8 opacity-40" />
            {/* oxlint-disable-next-line aido/spacing-scale -- 불러오는 칸이 아이콘 칸 높이(CELL_ICON_HEIGHT)와 같은 자리를 잡는다 */}
            <Spacing size={CELL_ICON_HEIGHT} />
            <TextSkeleton size="b1" className="w-8 opacity-40" />
          </VStack>
        ))}
      </Box>
    </WeatherCard>
  );
};

HourlyForecast.Empty = function Empty() {
  return null;
};
