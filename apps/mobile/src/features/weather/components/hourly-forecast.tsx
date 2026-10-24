import catImage from '@assets/images/cat_weather_anchor.png';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Spacing, Text, VStack, Box } from '@src/shared/ui';
import { getDateFormatContext } from '@src/shared/utils/date';
import { formatHourLabel } from '@src/shared/utils/date-format';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Image, ScrollView } from 'react-native';

import { useTimePalette } from '../hooks/use-time-palette';
import { useWeatherSession } from '../hooks/weather-session-provider';
import { useGetForecastQueryOptions } from '../queries/get-forecast-query-options';
import {
  type HourlyForecastViewModel,
  toUpcomingHourlyForecasts,
} from '../utils/view-models/hourly-forecast.view-model';
import { resolveIconBySky, resolveSkyIconColor } from '../utils/weather-icon';
import { WeatherCard } from './weather-card';

export function HourlyForecast() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { clock } = useWeatherSession();
  const [{ data: forecast }] = useSuspenseQueries({
    queries: [useGetForecastQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const items = toUpcomingHourlyForecasts(forecast.hourlyForecasts, clock.hour);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box className="relative mt-16">
      <Image
        source={catImage}
        className="absolute right-8 w-[140px] h-[102px] z-10"
        style={{ top: -102 }}
        resizeMode="contain"
      />
      <WeatherCard gap={12}>
        <Text size="b3" weight="semibold" className="mb-1" style={{ color: palette.text }}>
          {t('screen.hourly')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {items.map((item) => (
            <HourlyForecast.Item key={item.id} item={item} />
          ))}
        </ScrollView>
      </WeatherCard>
    </Box>
  );
}

HourlyForecast.Item = function Item({ item }: { item: HourlyForecastViewModel }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const SkyIcon = resolveIconBySky(item.skyCondition);
  const hourLabel = formatHourLabel(item.hour, preference.timeFormat, getDateFormatContext());

  return (
    <VStack py={16} px={20} className="items-center justify-between">
      <Text size="b3" align="center" style={{ color: palette.textSub }}>
        {item.dayOffset > 0 ? t('screen.nextDayHourLabel', { time: hourLabel }) : hourLabel}
      </Text>

      <Spacing size={8} />

      <SkyIcon
        width={24}
        height={24}
        color={resolveSkyIconColor(item.skyCondition, palette.icon)}
      />

      {item.precipitationProbability > 0 ? (
        <Text size="e2" align="center" style={{ color: palette.accent }}>
          {item.precipitationProbability}%
        </Text>
      ) : (
        <Spacing size={14} />
      )}

      <Spacing size={8} />

      <Text size="b3" weight="medium" align="center" style={{ color: palette.textSub }}>
        {Math.round(item.temperature)}°
      </Text>
    </VStack>
  );
};
