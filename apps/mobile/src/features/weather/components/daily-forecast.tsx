import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextSkeleton } from '@src/shared/ui';
import { CalendarIcon } from '@src/shared/ui/icon';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { zip } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { Separator } from 'heroui-native';
import { Fragment } from 'react';

import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import {
  type DailyForecast as DailyForecastDay,
  type TemperatureBar,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { formatDegrees } from '../utils/format-degrees';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

/** 이 확률 미만이면 강수 확률을 숨겨 아이콘 줄을 가볍게 둔다. */
const VISIBLE_CHANCE = 20;
const LOADING_ROW_COUNT = 5;

export function DailyForecast() {
  const { t } = useTranslation('weather');
  const { data, dataUpdatedAt } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.daily,
  });
  const todayKey = formatDateKey(new Date(dataUpdatedAt), data.location.timezone);
  const bars = WeatherReportPolicy.temperatureBars(data.daily);

  if (data.daily.length === 0) {
    return <DailyForecast.Empty />;
  }
  return (
    <WeatherCard
      title={t('daily.title', { count: data.daily.length })}
      icon={<CalendarIcon width={14} height={14} colorClassName="text-white/70" />}
    >
      {zip(data.daily, bars).map(([day, bar], index) => (
        <Fragment key={day.date}>
          {index > 0 && <Separator className="bg-white/15" />}
          <DailyForecast.Item day={day} bar={bar} isToday={day.date === todayKey} />
        </Fragment>
      ))}
    </WeatherCard>
  );
}

interface DailyForecastItemProps {
  day: DailyForecastDay;
  bar: TemperatureBar | undefined;
  isToday: boolean;
}

DailyForecast.Item = function Item({ day, bar, isToday }: DailyForecastItemProps) {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const dateFormat = useDateFormatContext();
  const label = isToday ? t('daily.today') : formatDateKeyLabel(day.date, 'weekday', dateFormat);
  const high = WeatherReportPolicy.displayTemperature(day.temperatureMax, unit);
  const low = WeatherReportPolicy.displayTemperature(day.temperatureMin, unit);

  return (
    <HStack
      align="center"
      gap={10}
      className="min-h-11"
      accessible
      accessibilityLabel={t('daily.item', {
        day: label,
        condition: t(WEATHER_CONDITION_LABEL_KEYS[day.condition]),
        high,
        low,
        chance: day.precipitationChance,
      })}
    >
      <Text size="b2" weight="semibold" tone="white" className="w-14" maxLines={1}>
        {label}
      </Text>
      <Box className="w-12 items-center">
        <WeatherIcon condition={day.condition} isDaylight />
        {day.precipitationChance >= VISIBLE_CHANCE && (
          <Text size="e2" weight="semibold" className="text-white/80">
            {`${day.precipitationChance}%`}
          </Text>
        )}
      </Box>
      <Text size="b2" className="w-10 text-right tabular-nums text-white/70">
        {formatDegrees(low)}
      </Text>
      <DailyForecast.TemperatureBar bar={bar} />
      <Text size="b2" weight="semibold" tone="white" className="w-10 text-right tabular-nums">
        {formatDegrees(high)}
      </Text>
    </HStack>
  );
};

/** 예보 기간 전체의 최저~최고 위에 하루의 범위를 겹쳐 그린다. */
DailyForecast.TemperatureBar = function TemperatureBarTrack({
  bar,
}: {
  bar: TemperatureBar | undefined;
}) {
  return (
    <Box flex={1} className="h-1 rounded-full bg-white/20">
      {bar != null && (
        <Box
          className="absolute h-1 rounded-full bg-white"
          style={{ left: `${bar.start * 100}%`, right: `${(1 - bar.end) * 100}%` }}
        />
      )}
    </Box>
  );
};

DailyForecast.Loading = function Loading() {
  return (
    <WeatherCard>
      <TextSkeleton size="e1" className="w-24 opacity-40" />
      {times(LOADING_ROW_COUNT, (index) => (
        <HStack key={index} align="center" gap={10} className="min-h-11">
          <TextSkeleton size="b2" className="w-14 opacity-40" />
          <TextSkeleton size="b2" className="flex-1 opacity-40" />
        </HStack>
      ))}
    </WeatherCard>
  );
};

DailyForecast.Empty = function Empty() {
  return null;
};
