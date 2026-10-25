import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack, Box } from '@src/shared/ui';
import { formatDateKeyLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { maxBy, minBy } from 'es-toolkit';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import {
  type DailyForecast as DailyForecastItem,
  type TemperatureTone,
  WeatherPolicy,
} from '../domains/weather.model';
import { useTimePalette } from '../hooks/use-time-palette';
import { useGetForecastQueryOptions } from '../queries/get-forecast-query-options';
import {
  resolveIconByPrecipitation,
  resolveIconBySky,
  resolveSkyIconColor,
} from '../utils/weather-icon';
import { WeatherCard } from './weather-card';

const TEMPERATURE_TONE_COLORS = {
  scorching: '#FF3B30',
  hot: '#FF8A80',
  warm: '#FF9500',
  mild: '#F5C842',
  fresh: '#8BC34A',
  cool: '#4FC3F7',
  chilly: '#A0D8FF',
  cold: '#2196F3',
} as const satisfies Record<TemperatureTone, string>;

export function DailyForecast() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { data: forecast } = useSuspenseQuery(useGetForecastQueryOptions());
  const items = forecast.dailyForecasts;

  if (items.length === 0) {
    return null;
  }

  const range = {
    min: minBy(items, (item) => item.temperatureMin)?.temperatureMin ?? 0,
    max: maxBy(items, (item) => item.temperatureMax)?.temperatureMax ?? 0,
  };

  return (
    <WeatherCard gap={8}>
      <Text size="b3" weight="semibold" className="mb-1" style={{ color: palette.text }}>
        {t('screen.weekly')}
      </Text>
      {items.map((item) => (
        <DailyForecast.Item key={item.date} item={item} range={range} />
      ))}
    </WeatherCard>
  );
}

DailyForecast.Item = function Item({
  item,
  range,
}: {
  item: DailyForecastItem;
  range: { min: number; max: number };
}) {
  const palette = useTimePalette();
  const dateFormatContext = useDateFormatContext();
  const Icon =
    resolveIconByPrecipitation(item.precipitationType) ?? resolveIconBySky(item.skyCondition);
  const iconColor =
    item.precipitationType === 'NONE'
      ? resolveSkyIconColor(item.skyCondition, palette.icon)
      : palette.icon;
  const span = range.max - range.min || 1;

  return (
    <HStack align="center" className="py-1 gap-3 px-1">
      <Text size="b3" weight="medium" className="w-8" style={{ color: palette.textSub }}>
        {formatDateKeyLabel(item.date, 'weekday', dateFormatContext)}
      </Text>

      <VStack align="center" className="w-10">
        <Icon width={20} height={20} color={iconColor} />
        {item.precipitationProbability > 0 && (
          <Text size="e2" style={{ color: palette.accent }}>
            {item.precipitationProbability}%
          </Text>
        )}
      </VStack>

      <Text
        size="b3"
        weight="medium"
        className="w-8 text-right"
        style={{ color: TEMPERATURE_TONE_COLORS.chilly }}
      >
        {Math.round(item.temperatureMin)}°
      </Text>
      <TemperatureBar
        id={item.date}
        left={((item.temperatureMin - range.min) / span) * 100}
        right={((range.max - item.temperatureMax) / span) * 100}
        fromColor={TEMPERATURE_TONE_COLORS[WeatherPolicy.temperatureTone(item.temperatureMin)]}
        toColor={TEMPERATURE_TONE_COLORS[WeatherPolicy.temperatureTone(item.temperatureMax)]}
      />
      <Text size="b3" weight="medium" className="w-8" style={{ color: palette.text }}>
        {Math.round(item.temperatureMax)}°
      </Text>
    </HStack>
  );
};

function TemperatureBar({
  id,
  left,
  right,
  fromColor,
  toColor,
}: {
  id: string;
  left: number;
  right: number;
  fromColor: string;
  toColor: string;
}) {
  const palette = useTimePalette();

  return (
    <Box
      className="flex-1 h-1 rounded-full overflow-hidden"
      style={{ backgroundColor: palette.glass }}
    >
      <Box
        className="absolute h-1 rounded-full overflow-hidden"
        style={{ left: `${left}%`, right: `${right}%` }}
      >
        <Svg width="100%" height={4}>
          <Defs>
            <SvgLinearGradient id={`tempBar-${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={fromColor} />
              <Stop offset="1" stopColor={toColor} />
            </SvgLinearGradient>
          </Defs>
          <Rect width="100%" height={4} rx={2} fill={`url(#tempBar-${id})`} />
        </Svg>
      </Box>
    </Box>
  );
}
