import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatClockTime, formatYearAwareDateKeyLabel } from '@src/shared/date/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Spacing, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { isNotNil, range } from 'es-toolkit';
import { Separator } from 'heroui-native';
import { match } from 'ts-pattern';

import { MOON_PHASE_LABEL_KEYS, SUN_EVENT_LABEL_KEYS } from '../constants/weather-labels';
import { WeatherDetailPolicy } from '../domains/weather-detail.model';
import {
  findTodayOrFirstForecast,
  getTodayKey,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import { useFormatLocalTime, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { getSunArcPosition, isSunBelowHorizon, SUN_ARC_VIEWBOX } from '../utils/sun-arc.geometry';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMoonIcon } from './weather-moon-icon';
import { WeatherSunArc } from './weather-sun-arc';

const SUN_FACT_COUNT = 3;

/** 해·달 시각은 예보 위치 시간대로 읽고, 벽시계가 기기와 다를 때만 다음 해 시각에 '현지'를 붙인다. */
export function WeatherSunMoon() {
  const { t } = useTranslation('weather');
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.sunMoon },
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const dateFormat = useLocationDateFormat(data.location.timezone);
  const localTime = useFormatLocalTime(data.location.timezone, now);
  const formatTime = (date: Instant) => formatClockTime(date, preference.timeFormat, dateFormat);
  const today = findTodayOrFirstForecast(data, now);
  if (today == null) {
    return null;
  }
  const todayKey = getTodayKey(data, now);
  const sunEvents = WeatherReportPolicy.getSunEvents(today, {
    isDaylight: data.current.isDaylight,
  });
  const nextEvent = WeatherDetailPolicy.findNextSunEvent(
    today,
    WeatherDetailPolicy.findDayAfter(data.daily, todayKey),
    now,
  );
  const daylight = WeatherDetailPolicy.findDaylightDuration(today);
  const nextFullMoon = WeatherDetailPolicy.findNextFullMoon(data.daily, todayKey);
  const headline = match(sunEvents)
    .with({ kind: 'polarDay' }, () => ({ value: t('sunMoon.polarDay'), label: null }))
    .with({ kind: 'polarNight' }, () => ({ value: t('sunMoon.polarNight'), label: null }))
    .with({ kind: 'regular' }, () =>
      nextEvent == null
        ? { value: t('details.noValue'), label: null }
        : {
            value: localTime(formatTime(nextEvent.at)),
            label: t(SUN_EVENT_LABEL_KEYS[nextEvent.kind]),
          },
    )
    .exhaustive();
  const isPolar = sunEvents.kind !== 'regular';
  const moonFacts = [
    today.moonrise == null ? null : t('sunMoon.moonrise', { time: formatTime(today.moonrise) }),
    today.moonset == null ? null : t('sunMoon.moonset', { time: formatTime(today.moonset) }),
    nextFullMoon == null
      ? null
      : t('sunMoon.nextFullMoon', {
          date: formatYearAwareDateKeyLabel(nextFullMoon, todayKey, dateFormat),
        }),
  ].filter(isNotNil);

  return (
    <WeatherCard
      title={t('sunMoon.title')}
      icon={<WeatherIcon.Card glyph="sunMoon" />}
      className="gap-0 px-4 pt-3.5 pb-4"
    >
      <HStack
        align="baseline"
        justify="between"
        gap={8}
        className="mt-1.5"
        accessible
        accessibilityLabel={
          headline.label == null
            ? headline.value
            : t('sunMoon.summary', { label: headline.label, time: headline.value })
        }
      >
        <Text
          tone="onSky"
          numberOfLines={isPolar ? 2 : 1}
          className={
            isPolar
              ? 'shrink text-b1 font-semibold'
              : 'shrink text-[32px] leading-[38px] font-normal tracking-[-1px] tabular-nums'
          }
        >
          {headline.value}
        </Text>
        {headline.label != null && (
          <Text size="b4" className="leading-[18px] text-on-sky/70">
            {headline.label}
          </Text>
        )}
      </HStack>
      <Spacing size={8} />
      <WeatherSunArc
        position={getSunArcPosition(today, now)}
        isNight={isSunBelowHorizon(today, now)}
      />
      {sunEvents.kind === 'regular' && (
        <HStack gap={4} className="mt-2">
          <WeatherSunMoon.Fact
            label={t('sunMoon.sunrise')}
            value={sunEvents.sunrise == null ? t('details.noValue') : formatTime(sunEvents.sunrise)}
            align="left"
          />
          <WeatherSunMoon.Fact
            label={t('sunMoon.daylight')}
            value={
              daylight == null ? t('details.noValue') : t('sunMoon.daylightValue', { ...daylight })
            }
            align="center"
          />
          <WeatherSunMoon.Fact
            label={t('sunMoon.sunset')}
            value={sunEvents.sunset == null ? t('details.noValue') : formatTime(sunEvents.sunset)}
            align="right"
          />
        </HStack>
      )}
      <Separator thickness={0.5} className="mt-3.5 bg-on-sky/[0.18]" />
      <HStack gap={12} align="center" className="mt-3.5">
        <WeatherMoonIcon phase={today.moonPhase} latitude={data.location.latitude} />
        <VStack className="min-w-0 flex-1" accessible>
          <Text size="b2" weight="semibold" tone="onSky" className="leading-[22px]">
            {t(MOON_PHASE_LABEL_KEYS[today.moonPhase])}
          </Text>
          {moonFacts.length > 0 && (
            <HStack className="flex-wrap gap-x-2">
              {moonFacts.map((fact) => (
                <Text key={fact} size="b4" className="leading-[18px] text-on-sky/70 tabular-nums">
                  {fact}
                </Text>
              ))}
            </HStack>
          )}
        </VStack>
      </HStack>
    </WeatherCard>
  );
}

WeatherSunMoon.Fact = function Fact({
  label,
  value,
  align,
}: {
  label: string;
  value: string;
  align: 'left' | 'center' | 'right';
}) {
  return (
    <VStack className="min-w-0 flex-1" accessible>
      <Text size="b4" align={align} className="leading-[18px] text-on-sky/60">
        {label}
      </Text>
      <Text
        size="b4"
        weight="semibold"
        tone="onSky"
        align={align}
        className="leading-[18px] tabular-nums"
      >
        {value}
      </Text>
    </VStack>
  );
};

/** 받은 뒤와 같은 자리를 잡는다. 제목, 큰 시각, 호, 사실 세 칸, 구분선, 달 아이콘과 두 줄이다. */
WeatherSunMoon.Loading = function Loading() {
  return (
    <WeatherCard className="gap-0 px-4 pt-3.5 pb-4">
      <TextSkeleton size="b4" className="w-16 opacity-40" />
      <TextSkeleton size="t1" className="mt-1.5 w-24 opacity-40" />
      <Box style={{ height: SUN_ARC_VIEWBOX.height }} />
      <HStack gap={4} className="mt-2">
        {range(SUN_FACT_COUNT).map((index) => (
          <VStack key={index} className="min-w-0 flex-1">
            <TextSkeleton size="b4" className="w-3/5 opacity-40" />
            <TextSkeleton size="b4" className="w-4/5 opacity-40" />
          </VStack>
        ))}
      </HStack>
      <Separator thickness={0.5} className="mt-3.5 bg-on-sky/[0.18]" />
      <HStack gap={12} align="center" className="mt-3.5">
        <Box className="size-[46px] rounded-full bg-on-sky/[0.12]" />
        <VStack className="min-w-0 flex-1">
          <TextSkeleton size="b2" className="w-24 opacity-40" />
          <TextSkeleton size="b4" className="w-40 opacity-40" />
        </VStack>
      </HStack>
    </WeatherCard>
  );
};
