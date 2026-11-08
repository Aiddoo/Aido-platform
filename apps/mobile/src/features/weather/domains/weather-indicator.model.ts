import { PM10_UPPER_BOUNDS, PM25_UPPER_BOUNDS } from '../constants/weather.constants';
import type { AirQuality, CurrentWeather } from './weather-report.model';

function getGradeIndex(value: number, upperBounds: readonly number[]): number {
  const index = upperBounds.findIndex((bound) => value <= bound);
  return index === -1 ? upperBounds.length : index;
}

export type AirPollutant = 'pm10' | 'pm25';

export type AirQualityGrade = 'good' | 'moderate' | 'bad' | 'veryBad';

const AIR_QUALITY_GRADES = [
  'good',
  'moderate',
  'bad',
  'veryBad',
] as const satisfies readonly AirQualityGrade[];

const POLLUTANT_UPPER_BOUNDS = {
  pm10: PM10_UPPER_BOUNDS,
  pm25: PM25_UPPER_BOUNDS,
} as const satisfies Record<AirPollutant, readonly number[]>;

function getPollutantGrade(
  airQuality: Pick<AirQuality, AirPollutant>,
  pollutant: AirPollutant,
): AirQualityGrade | null {
  const value = airQuality[pollutant];
  if (value == null) {
    return null;
  }
  return AIR_QUALITY_GRADES[getGradeIndex(value, POLLUTANT_UPPER_BOUNDS[pollutant])] ?? null;
}

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

const UV_LEVELS = [
  'low',
  'moderate',
  'high',
  'veryHigh',
  'extreme',
] as const satisfies readonly UvLevel[];
const UV_UPPER_BOUNDS = [2, 5, 7, 10] as const;

function getUvLevel({ uvIndex }: Pick<CurrentWeather, 'uvIndex'>): UvLevel {
  return UV_LEVELS[getGradeIndex(uvIndex, UV_UPPER_BOUNDS)] ?? 'extreme';
}

const FULL_TURN_DEGREES = 360;
const COMPASS_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];
const DEGREES_PER_DIRECTION = FULL_TURN_DEGREES / COMPASS_DIRECTIONS.length;

function getCompassDirection({
  windDirection,
}: Pick<CurrentWeather, 'windDirection'>): CompassDirection | null {
  if (windDirection == null) {
    return null;
  }
  const normalized = ((windDirection % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  const index = Math.round(normalized / DEGREES_PER_DIRECTION) % COMPASS_DIRECTIONS.length;
  return COMPASS_DIRECTIONS[index] ?? null;
}

export type FeelsLikeComparison = 'colder' | 'similar' | 'warmer';
const FEELS_LIKE_SIMILAR_RANGE = 2;

function getFeelsLikeComparison(
  current: Pick<CurrentWeather, 'temperature' | 'apparentTemperature'>,
): FeelsLikeComparison {
  const difference = current.apparentTemperature - current.temperature;
  if (Math.abs(difference) < FEELS_LIKE_SIMILAR_RANGE) {
    return 'similar';
  }
  return difference < 0 ? 'colder' : 'warmer';
}

export type VisibilityLevel = 'clear' | 'moderate' | 'poor';

const METERS_PER_KILOMETER = 1000;
const CLEAR_VISIBILITY_KM = 10;
const MODERATE_VISIBILITY_KM = 5;

function getVisibilityLevel({ visibility }: Pick<CurrentWeather, 'visibility'>): VisibilityLevel {
  const kilometers = visibility / METERS_PER_KILOMETER;
  if (kilometers >= CLEAR_VISIBILITY_KM) {
    return 'clear';
  }
  return kilometers >= MODERATE_VISIBILITY_KM ? 'moderate' : 'poor';
}

const OVERCAST_CLOUD_COVER = 80;
const MOSTLY_CLOUDY_CLOUD_COVER = 40;

export type CloudCoverLevel = 'overcast' | 'mostlyCloudy' | 'mostlyClear';

function getCloudCoverLevel({ cloudCover }: Pick<CurrentWeather, 'cloudCover'>): CloudCoverLevel {
  if (cloudCover >= OVERCAST_CLOUD_COVER) {
    return 'overcast';
  }
  return cloudCover >= MOSTLY_CLOUDY_CLOUD_COVER ? 'mostlyCloudy' : 'mostlyClear';
}

export type WindLevel = 'calm' | 'breeze' | 'strong';

const CALM_WIND_MPS = 1.5;
const STRONG_WIND_MPS = 5.5;

function getWindLevel({ windSpeed }: Pick<CurrentWeather, 'windSpeed'>): WindLevel {
  if (windSpeed < CALM_WIND_MPS) {
    return 'calm';
  }
  return windSpeed < STRONG_WIND_MPS ? 'breeze' : 'strong';
}

const MUGGY_HUMIDITY = 80;

function isMuggy({ humidity }: Pick<CurrentWeather, 'humidity'>): boolean {
  return humidity >= MUGGY_HUMIDITY;
}

export const WeatherIndicatorPolicy = {
  getPollutantGrade,
  getUvLevel,
  getCompassDirection,
  getFeelsLikeComparison,
  getVisibilityLevel,
  getCloudCoverLevel,
  getWindLevel,
  isMuggy,
} as const;
