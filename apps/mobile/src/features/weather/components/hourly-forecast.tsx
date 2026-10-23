import catImage from '@assets/images/cat_weather_anchor.png';
import { useTranslation } from '@src/shared/i18n';
import { Spacing, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Image, ScrollView, View } from 'react-native';

import { useTimePalette } from '../hooks/use-time-palette';
import { useGetForecastQueryOptions } from '../queries/get-forecast-query-options';
import {
  type HourlyForecastViewModel,
  toUpcomingHourlyForecasts,
} from '../utils/view-models/hourly-forecast.view-model';
import { resolveIconBySky, resolveSkyIconColor } from '../utils/weather-icon';
import { useWeatherSession } from './providers/weather-session-provider';
import { WeatherCard } from './weather-card';

export function HourlyForecast() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { clock } = useWeatherSession();
  const { data: forecast } = useSuspenseQuery(useGetForecastQueryOptions());
  const items = toUpcomingHourlyForecasts(forecast.hourlyForecasts, clock.hour);

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="relative mt-16">
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
    </View>
  );
}

HourlyForecast.Item = function Item({ item }: { item: HourlyForecastViewModel }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const SkyIcon = resolveIconBySky(item.skyCondition);

  return (
    <VStack py={16} px={20} className="items-center justify-between">
      <Text size="b3" align="center" style={{ color: palette.textSub }}>
        {t(item.dayOffset > 0 ? 'screen.nextDayHourLabel' : 'screen.hourLabel', {
          hour: item.hour,
        })}
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
