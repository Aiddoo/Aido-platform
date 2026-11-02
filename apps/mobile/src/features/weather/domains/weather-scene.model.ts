import type { WeatherCondition } from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

export const WEATHER_SCENE_SKIES = [
  'clearDay',
  'clearNight',
  'cloudyDay',
  'cloudyNight',
  'overcastDay',
  'overcastNight',
  'stormDay',
  'stormNight',
  'snowDay',
  'snowNight',
  'fogDay',
  'fogNight',
  'hazeDay',
  'hazeNight',
  'hotDay',
] as const;

export type WeatherSceneSky = (typeof WEATHER_SCENE_SKIES)[number];

export const WEATHER_SCENE_PRECIPITATION_KINDS = ['none', 'rain', 'snow', 'sleet', 'hail'] as const;

export type WeatherScenePrecipitationKind = (typeof WEATHER_SCENE_PRECIPITATION_KINDS)[number];

export const WEATHER_SCENE_MAX_PRECIPITATION_ANGLE = Math.PI / 6;

const HEAVY_PRECIPITATION_MM_PER_HOUR = 10;
const STRONG_WIND_METERS_PER_SECOND = 15;
const SUN_MAX_CLOUDS = 0.7;
const STARS_MAX_CLOUDS = 0.6;
const CELESTIAL_MAX_FOG = 0.5;

const unitSchema = z.number().min(0).max(1);

export const weatherSceneSchema = z.object({
  sky: z.enum(WEATHER_SCENE_SKIES),
  isDaylight: z.boolean(),
  precipitation: z.object({
    kind: z.enum(WEATHER_SCENE_PRECIPITATION_KINDS),
    density: unitSchema,
    speed: unitSchema,
    angle: z.number().min(0).max(WEATHER_SCENE_MAX_PRECIPITATION_ANGLE),
  }),
  clouds: unitSchema,
  fog: unitSchema,
  wind: unitSchema,
  lightning: z.boolean(),
  sun: z.boolean(),
  stars: z.boolean(),
});

export type WeatherScene = z.infer<typeof weatherSceneSchema>;

export type WeatherSceneInput = {
  condition: WeatherCondition;
  isDaylight: boolean;
  precipitationIntensity: number;
  cloudCover: number;
  windSpeed: number;
};

type SkyPair = { day: WeatherSceneSky; night: WeatherSceneSky };

type ConditionProfile = {
  sky: SkyPair;
  precipitation: WeatherScenePrecipitationKind;
  minDensity: number;
  speed: number;
  clouds: readonly [min: number, max: number];
  fog: number;
  minWind: number;
  lightning: boolean;
};

const CLEAR_SKY: SkyPair = { day: 'clearDay', night: 'clearNight' };
const CLOUDY_SKY: SkyPair = { day: 'cloudyDay', night: 'cloudyNight' };
const OVERCAST_SKY: SkyPair = { day: 'overcastDay', night: 'overcastNight' };
const STORM_SKY: SkyPair = { day: 'stormDay', night: 'stormNight' };
const SNOW_SKY: SkyPair = { day: 'snowDay', night: 'snowNight' };

const DRY: Pick<ConditionProfile, 'precipitation' | 'minDensity' | 'speed' | 'lightning'> = {
  precipitation: 'none',
  minDensity: 0,
  speed: 0,
  lightning: false,
};

function getConditionProfile(condition: WeatherCondition): ConditionProfile {
  return match(condition)
    .returnType<ConditionProfile>()
    .with('CLEAR', 'FRIGID', () => ({
      ...DRY,
      sky: CLEAR_SKY,
      clouds: [0, 0.15],
      fog: 0,
      minWind: 0,
    }))
    .with('HOT', () => ({
      ...DRY,
      sky: { day: 'hotDay', night: 'clearNight' },
      clouds: [0, 0.15],
      fog: 0.1,
      minWind: 0,
    }))
    .with('MOSTLY_CLEAR', () => ({
      ...DRY,
      sky: CLEAR_SKY,
      clouds: [0.1, 0.3],
      fog: 0,
      minWind: 0,
    }))
    .with('PARTLY_CLOUDY', () => ({
      ...DRY,
      sky: CLOUDY_SKY,
      clouds: [0.3, 0.6],
      fog: 0,
      minWind: 0,
    }))
    .with('MOSTLY_CLOUDY', () => ({
      ...DRY,
      sky: CLOUDY_SKY,
      clouds: [0.55, 0.85],
      fog: 0,
      minWind: 0,
    }))
    .with('CLOUDY', () => ({
      ...DRY,
      sky: OVERCAST_SKY,
      clouds: [0.85, 1],
      fog: 0.1,
      minWind: 0,
    }))
    .with('WINDY', () => ({
      ...DRY,
      sky: CLOUDY_SKY,
      clouds: [0.3, 0.7],
      fog: 0,
      minWind: 0.6,
    }))
    .with('FOGGY', () => ({
      ...DRY,
      sky: { day: 'fogDay', night: 'fogNight' },
      clouds: [0.3, 0.7],
      fog: 0.85,
      minWind: 0,
    }))
    .with('HAZY', () => ({
      ...DRY,
      sky: { day: 'hazeDay', night: 'hazeNight' },
      clouds: [0.1, 0.5],
      fog: 0.45,
      minWind: 0,
    }))
    .with('DRIZZLE', () => ({
      sky: OVERCAST_SKY,
      precipitation: 'rain',
      minDensity: 0.15,
      speed: 0.45,
      clouds: [0.7, 1],
      fog: 0.15,
      minWind: 0,
      lightning: false,
    }))
    .with('RAIN', () => ({
      sky: OVERCAST_SKY,
      precipitation: 'rain',
      minDensity: 0.4,
      speed: 0.7,
      clouds: [0.8, 1],
      fog: 0.1,
      minWind: 0,
      lightning: false,
    }))
    .with('HEAVY_RAIN', () => ({
      sky: STORM_SKY,
      precipitation: 'rain',
      minDensity: 0.8,
      speed: 0.9,
      clouds: [0.9, 1],
      fog: 0.25,
      minWind: 0.2,
      lightning: false,
    }))
    .with('THUNDERSTORMS', () => ({
      sky: STORM_SKY,
      precipitation: 'rain',
      minDensity: 0.7,
      speed: 1,
      clouds: [0.9, 1],
      fog: 0.15,
      minWind: 0.3,
      lightning: true,
    }))
    .with('SLEET', () => ({
      sky: OVERCAST_SKY,
      precipitation: 'sleet',
      minDensity: 0.4,
      speed: 0.55,
      clouds: [0.8, 1],
      fog: 0.15,
      minWind: 0,
      lightning: false,
    }))
    .with('SNOW', () => ({
      sky: SNOW_SKY,
      precipitation: 'snow',
      minDensity: 0.35,
      speed: 0.25,
      clouds: [0.7, 1],
      fog: 0.1,
      minWind: 0,
      lightning: false,
    }))
    .with('HEAVY_SNOW', () => ({
      sky: SNOW_SKY,
      precipitation: 'snow',
      minDensity: 0.8,
      speed: 0.35,
      clouds: [0.9, 1],
      fog: 0.3,
      minWind: 0.2,
      lightning: false,
    }))
    .with('HAIL', () => ({
      sky: STORM_SKY,
      precipitation: 'hail',
      minDensity: 0.5,
      speed: 0.85,
      clouds: [0.85, 1],
      fog: 0.1,
      minWind: 0.2,
      lightning: false,
    }))
    .exhaustive();
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function normalizePrecipitationIntensity(millimetersPerHour: number): number {
  if (!(millimetersPerHour > 0)) {
    return 0;
  }
  return clampUnit(Math.log1p(millimetersPerHour) / Math.log1p(HEAVY_PRECIPITATION_MM_PER_HOUR));
}

export function normalizeWindSpeed(metersPerSecond: number): number {
  return clampUnit(metersPerSecond / STRONG_WIND_METERS_PER_SECOND);
}

export function normalizeCloudCover(percent: number, range: readonly [number, number]): number {
  const [min, max] = range;
  if (Number.isNaN(percent)) {
    return min;
  }
  return Math.min(max, Math.max(min, percent / 100));
}

export function precipitationAngle(wind: number): number {
  return clampUnit(wind) * WEATHER_SCENE_MAX_PRECIPITATION_ANGLE;
}

export function hasPrecipitation(scene: WeatherScene): boolean {
  return scene.precipitation.kind !== 'none';
}

export function showsSun(scene: Pick<WeatherScene, 'isDaylight' | 'clouds' | 'fog'>): boolean {
  return scene.isDaylight && scene.clouds < SUN_MAX_CLOUDS && scene.fog < CELESTIAL_MAX_FOG;
}

export function showsStars(scene: Pick<WeatherScene, 'isDaylight' | 'clouds' | 'fog'>): boolean {
  return !scene.isDaylight && scene.clouds < STARS_MAX_CLOUDS && scene.fog < CELESTIAL_MAX_FOG;
}

export function toWeatherScene(input: WeatherSceneInput): WeatherScene {
  const profile = getConditionProfile(input.condition);
  const isDry = profile.precipitation === 'none';
  const wind = Math.max(profile.minWind, normalizeWindSpeed(input.windSpeed));
  const density = isDry
    ? 0
    : Math.max(profile.minDensity, normalizePrecipitationIntensity(input.precipitationIntensity));
  const atmosphere = {
    isDaylight: input.isDaylight,
    clouds: normalizeCloudCover(input.cloudCover, profile.clouds),
    fog: profile.fog,
  };
  const canSeeSky = isDry && !profile.lightning;

  return {
    sky: input.isDaylight ? profile.sky.day : profile.sky.night,
    ...atmosphere,
    precipitation: {
      kind: profile.precipitation,
      density,
      speed: profile.speed,
      angle: isDry ? 0 : precipitationAngle(wind),
    },
    wind,
    lightning: profile.lightning,
    sun: canSeeSky && showsSun(atmosphere),
    stars: canSeeSky && showsStars(atmosphere),
  };
}

export const WeatherScenePolicy = {
  fromInput: toWeatherScene,
  precipitationDensity: normalizePrecipitationIntensity,
  wind: normalizeWindSpeed,
  clouds: normalizeCloudCover,
  precipitationAngle,
  hasPrecipitation,
  showsSun,
  showsStars,
} as const;
