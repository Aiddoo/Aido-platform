import type { PrecipitationType, SkyCondition } from '@aido/validators';
import {
  WeatherClearIcon,
  WeatherCloudyIcon,
  WeatherPartlyCloudyIcon,
  WeatherRainIcon,
  WeatherShowerIcon,
  WeatherSnowIcon,
} from '@src/shared/ui/Icon';

interface WeatherConditionIconProps {
  skyCondition: SkyCondition;
  precipitationType: PrecipitationType;
  size?: number;
  colorClassName?: string;
}

const getWeatherIcon = (skyCondition: SkyCondition, precipitationType: PrecipitationType) => {
  if (precipitationType === 'RAIN') return WeatherRainIcon;
  if (precipitationType === 'SNOW') return WeatherSnowIcon;
  if (precipitationType === 'RAIN_SNOW') return WeatherRainIcon;
  if (precipitationType === 'SHOWER') return WeatherShowerIcon;

  if (skyCondition === 'CLEAR') return WeatherClearIcon;
  if (skyCondition === 'PARTLY_CLOUDY') return WeatherPartlyCloudyIcon;
  return WeatherCloudyIcon;
};

export function WeatherConditionIcon({
  skyCondition,
  precipitationType,
  size = 24,
  colorClassName = 'text-gray-8',
}: WeatherConditionIconProps) {
  const Icon = getWeatherIcon(skyCondition, precipitationType);
  return <Icon width={size} height={size} colorClassName={colorClassName} />;
}
