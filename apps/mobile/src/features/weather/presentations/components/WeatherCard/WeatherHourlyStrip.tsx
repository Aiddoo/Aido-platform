import type { SkyCondition } from '@aido/validators';
import { Text, VStack } from '@src/shared/ui';
import { ScrollView } from 'react-native';
import { WeatherPolicy } from '../../../models/weather.model';
import { WeatherConditionIcon } from './WeatherConditionIcon';

interface HourlyForecastItem {
  hour: number;
  temperature: number;
  skyCondition: SkyCondition;
  precipitationProbability: number;
}

interface WeatherHourlyStripProps {
  hourlyForecasts: HourlyForecastItem[];
}

const formatHour = (hour: number) => `${hour}시`;

export function WeatherHourlyStrip({ hourlyForecasts }: WeatherHourlyStripProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2">
      {hourlyForecasts.map((forecast) => (
        <VStack key={forecast.hour} className="w-[56px]" align="center" gap={6}>
          <Text size="e2" shade={6}>
            {formatHour(forecast.hour)}
          </Text>

          <WeatherConditionIcon
            skyCondition={forecast.skyCondition}
            precipitationType="NONE"
            size={20}
          />

          <Text size="e1" weight="medium" shade={8}>
            {Math.round(forecast.temperature)}°
          </Text>

          {WeatherPolicy.shouldShowHourlyPrecipitation(forecast) && (
            <Text size="e2" className="text-blue-600 dark:text-blue-400">
              {forecast.precipitationProbability}%
            </Text>
          )}
        </VStack>
      ))}
    </ScrollView>
  );
}
