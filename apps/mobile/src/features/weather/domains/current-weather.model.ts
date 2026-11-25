import {
  WEATHER_CONDITIONS,
  WEATHER_PRESSURE_TRENDS,
  type WeatherCondition,
  type WeatherPrecipitationType,
} from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

/** 지금 관측된 날씨. 기온은 °C, 풍속은 m/s, 가시거리는 m, 기압은 hPa다 */
export const currentWeatherSchema = z.object({
  observedAt: instantSchema,
  condition: z.enum(WEATHER_CONDITIONS),
  isDaylight: z.boolean(),
  temperature: z.number(),
  apparentTemperature: z.number(),
  dewPoint: z.number(),
  humidity: z.number(),
  cloudCover: z.number(),
  uvIndex: z.number(),
  windSpeed: z.number(),
  windGust: z.number().nullable(),
  windDirection: z.number().nullable(),
  visibility: z.number(),
  pressure: z.number(),
  pressureTrend: z.enum(WEATHER_PRESSURE_TRENDS),
  precipitationIntensity: z.number(),
});
export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

/** WHO 자외선 지수 기준. 각 값 이하가 해당 단계이고 넘으면 위험이다 */
const UV_LEVEL_UPPER_BOUNDS = [
  { level: 'low', upTo: 2 },
  { level: 'moderate', upTo: 5 },
  { level: 'high', upTo: 7 },
  { level: 'veryHigh', upTo: 10 },
] as const satisfies readonly { level: UvLevel; upTo: number }[];

const FULL_TURN_DEGREES = 360;
const COMPASS_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];
const DEGREES_PER_DIRECTION = FULL_TURN_DEGREES / COMPASS_DIRECTIONS.length;

export type FeelsLikeComparison = 'colder' | 'similar' | 'warmer';
/** 체감 온도와 실제 기온의 차이가 이 값(°C) 미만이면 비슷하다고 본다. */
const FEELS_LIKE_SIMILAR_RANGE_CELSIUS = 2;

export type VisibilityLevel = 'clear' | 'moderate' | 'poor';

const METERS_PER_KILOMETER = 1000;
const CLEAR_VISIBILITY_KM = 10;
const MODERATE_VISIBILITY_KM = 5;

const OVERCAST_CLOUD_COVER_PERCENT = 80;
const MOSTLY_CLOUDY_CLOUD_COVER_PERCENT = 40;

export type CloudCoverLevel = 'overcast' | 'mostlyCloudy' | 'mostlyClear';

export type WindLevel = 'calm' | 'breeze' | 'strong';

/** 보퍼트 풍력 1(실바람) 미만은 잔잔, 4(건들바람) 이상은 강하다고 본다. */
const CALM_WIND_MPS = 1.5;
const STRONG_WIND_MPS = 5.5;

/** 상대 습도가 이 값(%) 이상이면 눅눅하다고 안내한다. */
const MUGGY_HUMIDITY_PERCENT = 80;

/** 비·눈 상태를 강수 형태로 읽는다. 비·눈이 아닌 상태면 null이다. */
function findConditionPrecipitationType(
  condition: WeatherCondition,
): WeatherPrecipitationType | null {
  return match<WeatherCondition, WeatherPrecipitationType | null>(condition)
    .with('DRIZZLE', 'RAIN', 'HEAVY_RAIN', 'THUNDERSTORMS', () => 'RAIN')
    .with('SNOW', 'HEAVY_SNOW', () => 'SNOW')
    .with('SLEET', () => 'SLEET')
    .with('HAIL', () => 'HAIL')
    .with(
      'CLEAR',
      'MOSTLY_CLEAR',
      'PARTLY_CLOUDY',
      'MOSTLY_CLOUDY',
      'CLOUDY',
      'FOGGY',
      'HAZY',
      'WINDY',
      'HOT',
      'FRIGID',
      () => null,
    )
    .exhaustive();
}

export const CurrentWeatherPolicy = {
  getUvLevel(current: CurrentWeather): UvLevel {
    return UV_LEVEL_UPPER_BOUNDS.find(({ upTo }) => current.uvIndex <= upTo)?.level ?? 'extreme';
  },

  /** 바람이 불어오는 방향(북=0도)을 8방위로 나눈다. 무풍 등으로 방향이 없으면 null이다. */
  findCompassDirection(current: CurrentWeather): CompassDirection | null {
    if (current.windDirection == null) {
      return null;
    }
    const normalized =
      ((current.windDirection % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
    const index = Math.round(normalized / DEGREES_PER_DIRECTION) % COMPASS_DIRECTIONS.length;
    return COMPASS_DIRECTIONS[index] ?? null;
  },

  getFeelsLikeComparison(current: CurrentWeather): FeelsLikeComparison {
    const difference = current.apparentTemperature - current.temperature;
    if (Math.abs(difference) < FEELS_LIKE_SIMILAR_RANGE_CELSIUS) {
      return 'similar';
    }
    return difference < 0 ? 'colder' : 'warmer';
  },

  getVisibilityLevel(current: CurrentWeather): VisibilityLevel {
    const kilometers = current.visibility / METERS_PER_KILOMETER;
    if (CLEAR_VISIBILITY_KM <= kilometers) {
      return 'clear';
    }
    return MODERATE_VISIBILITY_KM <= kilometers ? 'moderate' : 'poor';
  },

  getCloudCoverLevel(current: CurrentWeather): CloudCoverLevel {
    if (OVERCAST_CLOUD_COVER_PERCENT <= current.cloudCover) {
      return 'overcast';
    }
    return MOSTLY_CLOUDY_CLOUD_COVER_PERCENT <= current.cloudCover ? 'mostlyCloudy' : 'mostlyClear';
  },

  getWindLevel(current: CurrentWeather): WindLevel {
    if (current.windSpeed < CALM_WIND_MPS) {
      return 'calm';
    }
    return current.windSpeed < STRONG_WIND_MPS ? 'breeze' : 'strong';
  },

  isMuggy(current: CurrentWeather) {
    return MUGGY_HUMIDITY_PERCENT <= current.humidity;
  },

  /** 지금 내리는 강수의 형태. 관측된 강수가 없거나 비·눈 상태가 아니면 null이다 */
  findObservedPrecipitationType(current: CurrentWeather) {
    return 0 < current.precipitationIntensity
      ? findConditionPrecipitationType(current.condition)
      : null;
  },
};
