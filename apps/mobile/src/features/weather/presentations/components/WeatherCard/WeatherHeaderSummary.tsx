import { ErrorCode } from '@aido/errors';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { isApiError } from '@src/shared/errors/api-error';
import { HStack, Text } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { WeatherPolicy } from '../../../models/weather.model';
import { SKY_CONDITION_LABEL } from '../../constants/weather-labels.constant';
import { useGetForecastQueryOptions } from '../../queries/use-get-forecast-query-options';
import { WeatherConditionIcon } from './WeatherConditionIcon';

export function WeatherHeaderSummary() {
  const router = useRouter();
  const [selectedDate] = useFeedDate();
  const date = formatDate(selectedDate);
  const { data: forecast, error } = useQuery(useGetForecastQueryOptions(date));

  if (error && isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)) {
    return null;
  }

  if (!forecast) {
    return null;
  }

  const showPrecip = WeatherPolicy.shouldShowPrecipitation(forecast);

  return (
    <Pressable onPress={() => router.push('/weather')} hitSlop={8}>
      <HStack align="center" gap={5}>
        <WeatherConditionIcon
          skyCondition={forecast.skyCondition}
          precipitationType={forecast.precipitationType}
          size={18}
        />
        <Text size="e1" weight="semibold" shade={9}>
          {Math.round(forecast.temperatureMin)}°/{Math.round(forecast.temperatureMax)}°
        </Text>
        <Text size="e2" shade={6}>
          {SKY_CONDITION_LABEL[forecast.skyCondition]}
        </Text>
        {showPrecip && (
          <Text size="e2" className="text-blue-500 dark:text-blue-400">
            {forecast.precipitationProbability}%
          </Text>
        )}
      </HStack>
    </Pressable>
  );
}
