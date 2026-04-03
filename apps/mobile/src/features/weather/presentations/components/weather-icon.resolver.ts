import type { PrecipitationType, SkyCondition } from '@aido/validators';
import {
  WeatherClearIcon,
  WeatherCloudyIcon,
  WeatherPartlyCloudyIcon,
  WeatherRainIcon,
  WeatherShowerIcon,
  WeatherSnowIcon,
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
    .with('CLEAR', () => WeatherClearIcon)
    .with('PARTLY_CLOUDY', () => WeatherPartlyCloudyIcon)
    .with('CLOUDY', () => WeatherCloudyIcon)
    .exhaustive();

export const resolveSkyIconColor = (condition: SkyCondition, fallback: string) =>
  condition === 'CLEAR' ? '#FFD233' : fallback;
