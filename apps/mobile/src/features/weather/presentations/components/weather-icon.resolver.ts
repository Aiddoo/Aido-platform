import type { PrecipitationType, SkyCondition } from '@aido/validators';
import {
  WeatherCloudyIcon,
  WeatherPartlyCloudyIcon,
  WeatherRainIcon,
  WeatherShowerIcon,
  WeatherSnowIcon,
  WeatherSunIcon,
} from '@src/shared/ui/Icon';
import { match } from 'ts-pattern';

export const resolveIconByPrecipitation = (type: PrecipitationType) =>
  match(type)
    .with('RAIN', 'RAIN_SNOW', () => WeatherRainIcon)
    .with('SNOW', () => WeatherSnowIcon)
    .with('SHOWER', () => WeatherShowerIcon)
    .with('NONE', () => null)
    .exhaustive();

export const resolveIconBySky = (condition: SkyCondition) =>
  match(condition)
    .with('CLEAR', () => WeatherSunIcon)
    .with('PARTLY_CLOUDY', () => WeatherPartlyCloudyIcon)
    .with('CLOUDY', () => WeatherCloudyIcon)
    .exhaustive();
