import catImage from '@assets/images/cat_weather_anchor.png';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, Spacing, Text, TextSkeleton, VStack } from '@src/shared/ui';
import {
  type DateFormatContext,
  formatHourLabel,
  getZonedHour,
  type TimeFormat,
} from '@src/shared/utils/date-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { FlatList, useWindowDimensions } from 'react-native';

import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import {
  type HourlyForecast as HourlyForecastItem,
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
import { WeatherMascot } from './weather-mascot';

/** 이 확률 미만이면 강수 확률을 숨겨 아이콘 줄을 가볍게 둔다. */
const VISIBLE_CHANCE = 20;
/** 칸 폭은 글자 배율에 비례해 늘려 시각·온도가 잘리지 않게 한다. */
const CELL_WIDTH = 56;

export function HourlyForecast() {
  const { t } = useTranslation('weather');
  const [{ data, dataUpdatedAt }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.hourly },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = { ...useDateFormatContext(), timeZone: data.location.timezone };
  const hours = WeatherReportPolicy.upcomingHours(data.hourly, new Date(dataUpdatedAt));

  if (hours.length === 0) {
    return <HourlyForecast.Empty />;
  }

  return (
    <Box>
      <WeatherMascot
        source={catImage}
        className="absolute -top-[72px] right-6 h-[73px] w-[100px]"
        fallbackCondition="PARTLY_CLOUDY"
      />
      <WeatherCard title={t('hourly.title')}>
        <FlatList
          horizontal
          data={hours}
          keyExtractor={(hour) => String(hour.startsAt.getTime())}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={8}
          renderItem={({ item, index }) => (
            <HourlyForecast.Item
              hour={item}
              isNow={index === 0}
              dateFormat={dateFormat}
              timeFormat={preference.timeFormat}
            />
          )}
        />
      </WeatherCard>
    </Box>
  );
}

interface HourlyForecastItemProps {
  hour: HourlyForecastItem;
  isNow: boolean;
  dateFormat: DateFormatContext;
  timeFormat: TimeFormat;
}

HourlyForecast.Item = function Item({
  hour,
  isNow,
  dateFormat,
  timeFormat,
}: HourlyForecastItemProps) {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const { fontScale } = useWindowDimensions();
  const time = isNow
    ? t('hourly.now')
    : formatHourLabel(getZonedHour(hour.startsAt, dateFormat.timeZone), timeFormat, dateFormat);
  const temperature = WeatherReportPolicy.displayTemperature(hour.temperature, unit);

  return (
    <VStack
      align="center"
      gap={6}
      style={{ width: CELL_WIDTH * fontScale }}
      accessible
      accessibilityLabel={t('hourly.item', {
        time,
        temperature,
        condition: t(WEATHER_CONDITION_LABEL_KEYS[hour.condition]),
        chance: hour.precipitationChance,
      })}
    >
      <Text size="b4" weight="medium" tone="white">
        {time}
      </Text>
      <WeatherIcon condition={hour.condition} isDaylight={hour.isDaylight} />
      {hour.precipitationChance >= VISIBLE_CHANCE ? (
        <Text size="e2" weight="semibold" className="text-white/80">
          {`${hour.precipitationChance}%`}
        </Text>
      ) : (
        <Text size="e2" className="opacity-0" accessible={false}>
          0%
        </Text>
      )}
      <Text size="b2" weight="medium" tone="white">
        {formatDegrees(temperature)}
      </Text>
    </VStack>
  );
};

HourlyForecast.Loading = function Loading() {
  return (
    <WeatherCard>
      <TextSkeleton size="e1" className="w-24 opacity-40" />
      <Box className="flex-row">
        {times(6, (index) => (
          <VStack key={index} align="center" gap={6} style={{ width: CELL_WIDTH }}>
            <TextSkeleton size="b4" className="w-8 opacity-40" />
            <Spacing size={24} />
            <TextSkeleton size="b2" className="w-8 opacity-40" />
          </VStack>
        ))}
      </Box>
    </WeatherCard>
  );
};

HourlyForecast.Empty = function Empty() {
  return null;
};
