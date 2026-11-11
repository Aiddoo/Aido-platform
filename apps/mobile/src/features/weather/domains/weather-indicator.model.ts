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

/** 환경부 통합 예보 기준 (μg/m³). 각 값 이하가 해당 등급이다 */
/** 좋음·보통·나쁨의 상한. 넘으면 매우 나쁨이다 */
type PollutantUpperBounds = readonly [good: number, moderate: number, bad: number];

const POLLUTANT_UPPER_BOUNDS = {
  pm10: [30, 80, 150],
  pm25: [15, 35, 75],
} as const satisfies Record<AirPollutant, PollutantUpperBounds>;

/** 등급을 나누는 경계. 대기질 막대 눈금도 같은 경계로 나눈다 */
export function getPollutantUpperBounds(pollutant: AirPollutant): PollutantUpperBounds {
  return POLLUTANT_UPPER_BOUNDS[pollutant];
}

/** 오염 물질 하나의 등급. 그 물질의 값이 없으면 null이다. */
function getPollutantGrade(
  airQuality: AirQuality,
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
/** WHO 자외선 지수 기준. 각 값 이하가 해당 단계다. */
const UV_UPPER_BOUNDS = [2, 5, 7, 10] as const;

function getUvLevel({ uvIndex }: CurrentWeather): UvLevel {
  return UV_LEVELS[getGradeIndex(uvIndex, UV_UPPER_BOUNDS)] ?? 'extreme';
}

const FULL_TURN_DEGREES = 360;
const COMPASS_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];
const DEGREES_PER_DIRECTION = FULL_TURN_DEGREES / COMPASS_DIRECTIONS.length;

/** 바람이 불어오는 방향(북=0도)을 8방위로 나눈다. 무풍 등으로 방향이 없으면 null이다. */
function getCompassDirection({ windDirection }: CurrentWeather): CompassDirection | null {
  if (windDirection == null) {
    return null;
  }
  const normalized = ((windDirection % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  const index = Math.round(normalized / DEGREES_PER_DIRECTION) % COMPASS_DIRECTIONS.length;
  return COMPASS_DIRECTIONS[index] ?? null;
}

export type FeelsLikeComparison = 'colder' | 'similar' | 'warmer';
/** 체감 온도와 실제 기온의 차이가 이 값(°C) 미만이면 비슷하다고 본다. */
const FEELS_LIKE_SIMILAR_RANGE = 2;

function getFeelsLikeComparison(current: CurrentWeather): FeelsLikeComparison {
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

function getVisibilityLevel({ visibility }: CurrentWeather): VisibilityLevel {
  const kilometers = visibility / METERS_PER_KILOMETER;
  if (kilometers >= CLEAR_VISIBILITY_KM) {
    return 'clear';
  }
  return kilometers >= MODERATE_VISIBILITY_KM ? 'moderate' : 'poor';
}

const OVERCAST_CLOUD_COVER = 80;
const MOSTLY_CLOUDY_CLOUD_COVER = 40;

export type CloudCoverLevel = 'overcast' | 'mostlyCloudy' | 'mostlyClear';

function getCloudCoverLevel({ cloudCover }: CurrentWeather): CloudCoverLevel {
  if (cloudCover >= OVERCAST_CLOUD_COVER) {
    return 'overcast';
  }
  return cloudCover >= MOSTLY_CLOUDY_CLOUD_COVER ? 'mostlyCloudy' : 'mostlyClear';
}

export type WindLevel = 'calm' | 'breeze' | 'strong';

/** 보퍼트 풍력 1(실바람) 미만은 잔잔, 4(건들바람) 이상은 강하다고 본다. */
const CALM_WIND_MPS = 1.5;
const STRONG_WIND_MPS = 5.5;

function getWindLevel({ windSpeed }: CurrentWeather): WindLevel {
  if (windSpeed < CALM_WIND_MPS) {
    return 'calm';
  }
  return windSpeed < STRONG_WIND_MPS ? 'breeze' : 'strong';
}

/** 상대 습도가 이 값(%) 이상이면 눅눅하다고 안내한다. */
const MUGGY_HUMIDITY = 80;

function isMuggy({ humidity }: CurrentWeather): boolean {
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
