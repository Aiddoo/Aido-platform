import type { WeatherCondition } from '@aido/api';
import { DAY_MS } from '@src/shared/constants/time.constants';
import { clamp } from 'es-toolkit';
import { match } from 'ts-pattern';

const WEATHER_SCENE_SKIES = [
  'clearDay',
  'clearNight',
  'cloudyDay',
  'cloudyNight',
  'overcastDay',
  'overcastNight',
  'rainDay',
  'rainNight',
  'stormDay',
  'stormNight',
  'snowDay',
  'snowNight',
  'fogDay',
  'fogNight',
  'hazeDay',
  'hazeNight',
  'hotDay',
  'hotNight',
  'frigidDay',
  'frigidNight',
] as const;

export type WeatherSceneSky = (typeof WEATHER_SCENE_SKIES)[number];

const WEATHER_SCENE_PRECIPITATION_KINDS = [
  'none',
  'drizzle',
  'rain',
  'sleet',
  'snow',
  'hail',
] as const;

export type WeatherScenePrecipitationKind = (typeof WEATHER_SCENE_PRECIPITATION_KINDS)[number];

/** 날씨마다 하나씩 두는 대표 대기 효과 */
const WEATHER_SCENE_ATMOSPHERES = [
  'calm',
  'fogBands',
  'haze',
  'gusts',
  'mistyGlass',
  'heat',
  'frost',
] as const;

export type WeatherSceneAtmosphere = (typeof WEATHER_SCENE_ATMOSPHERES)[number];

const WEATHER_SCENE_SUNS = ['hidden', 'bright', 'diffuse', 'blazing'] as const;

export type WeatherSceneSun = (typeof WEATHER_SCENE_SUNS)[number];

type VisibleSun = Exclude<WeatherSceneSun, 'hidden'>;

export const WEATHER_SCENE_MAX_PRECIPITATION_ANGLE = Math.PI / 9;

const HEAVY_PRECIPITATION_MM_PER_HOUR = 10;
const STRONG_WIND_METERS_PER_SECOND = 15;
const SUN_MAX_CLOUDS = 0.7;
const MOON_MAX_CLOUDS = 0.75;
const STARS_MAX_CLOUDS = 0.6;
const SHOOTING_STARS_MAX_CLOUDS = 0.3;
const CELESTIAL_MAX_FOG = 0.5;
/** 삭망월(일)과 기준 삭 시각(2000-01-06 18:14 UTC) */
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

export interface WeatherScene {
  sky: WeatherSceneSky;
  isDaylight: boolean;
  precipitation: {
    kind: WeatherScenePrecipitationKind;
    density: number;
    speed: number;
    angle: number;
  };
  clouds: number;
  /** 화면 아래에 낮게 깔리는 물안개 양 */
  fog: number;
  wind: number;
  atmosphere: WeatherSceneAtmosphere;
  lightning: boolean;
  sun: WeatherSceneSun;
  lensFlare: boolean;
  moon: boolean;
  /** 달의 위상. 0은 삭, 0.5는 보름, 1에 가까울수록 그믐이다. */
  moonPhase: number;
  /** 남반구에서는 달의 밝은 면이 반대로 보인다. */
  isSouthernHemisphere: boolean;
  stars: boolean;
  shootingStars: boolean;
}

export type WeatherSceneInput = {
  condition: WeatherCondition;
  isDaylight: boolean;
  precipitationIntensity: number;
  cloudCover: number;
  windSpeed: number;
  observedAt: Date;
  latitude: number;
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
  atmosphere: WeatherSceneAtmosphere;
  sun: VisibleSun;
  lensFlare: boolean;
};

const CLEAR_SKY: SkyPair = { day: 'clearDay', night: 'clearNight' };
const CLOUDY_SKY: SkyPair = { day: 'cloudyDay', night: 'cloudyNight' };
const OVERCAST_SKY: SkyPair = { day: 'overcastDay', night: 'overcastNight' };
const RAIN_SKY: SkyPair = { day: 'rainDay', night: 'rainNight' };
const STORM_SKY: SkyPair = { day: 'stormDay', night: 'stormNight' };
const SNOW_SKY: SkyPair = { day: 'snowDay', night: 'snowNight' };

const BASE_PROFILE = {
  precipitation: 'none',
  minDensity: 0,
  speed: 0,
  fog: 0,
  minWind: 0,
  lightning: false,
  atmosphere: 'calm',
  sun: 'bright',
  lensFlare: false,
} as const satisfies Omit<ConditionProfile, 'sky' | 'clouds'>;

function getConditionProfile(condition: WeatherCondition): ConditionProfile {
  return match(condition)
    .returnType<ConditionProfile>()
    .with('CLEAR', () => ({
      ...BASE_PROFILE,
      sky: CLEAR_SKY,
      clouds: [0, 0.15],
      lensFlare: true,
    }))
    .with('MOSTLY_CLEAR', () => ({
      ...BASE_PROFILE,
      sky: CLEAR_SKY,
      clouds: [0.1, 0.3],
      lensFlare: true,
    }))
    .with('PARTLY_CLOUDY', () => ({ ...BASE_PROFILE, sky: CLOUDY_SKY, clouds: [0.3, 0.6] }))
    .with('MOSTLY_CLOUDY', () => ({ ...BASE_PROFILE, sky: CLOUDY_SKY, clouds: [0.55, 0.85] }))
    .with('CLOUDY', () => ({ ...BASE_PROFILE, sky: OVERCAST_SKY, clouds: [0.85, 1], fog: 0.1 }))
    .with('FOGGY', () => ({
      ...BASE_PROFILE,
      sky: { day: 'fogDay', night: 'fogNight' },
      clouds: [0.3, 0.7],
      fog: 0.85,
      atmosphere: 'fogBands',
    }))
    .with('HAZY', () => ({
      ...BASE_PROFILE,
      sky: { day: 'hazeDay', night: 'hazeNight' },
      clouds: [0.1, 0.5],
      atmosphere: 'haze',
      sun: 'diffuse',
    }))
    .with('WINDY', () => ({
      ...BASE_PROFILE,
      sky: CLOUDY_SKY,
      clouds: [0.3, 0.7],
      minWind: 0.6,
      atmosphere: 'gusts',
    }))
    .with('DRIZZLE', () => ({
      ...BASE_PROFILE,
      sky: RAIN_SKY,
      precipitation: 'drizzle',
      minDensity: 0.7,
      speed: 0.45,
      clouds: [0.7, 1],
      fog: 0.15,
      atmosphere: 'mistyGlass',
    }))
    .with('RAIN', () => ({
      ...BASE_PROFILE,
      sky: RAIN_SKY,
      precipitation: 'rain',
      minDensity: 0.4,
      speed: 0.7,
      clouds: [0.8, 1],
      fog: 0.1,
    }))
    .with('HEAVY_RAIN', () => ({
      ...BASE_PROFILE,
      sky: RAIN_SKY,
      precipitation: 'rain',
      minDensity: 0.8,
      speed: 0.9,
      clouds: [0.9, 1],
      fog: 0.25,
      minWind: 0.2,
    }))
    .with('THUNDERSTORMS', () => ({
      ...BASE_PROFILE,
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
      ...BASE_PROFILE,
      sky: RAIN_SKY,
      precipitation: 'sleet',
      minDensity: 0.4,
      speed: 0.55,
      clouds: [0.8, 1],
      fog: 0.15,
    }))
    .with('SNOW', () => ({
      ...BASE_PROFILE,
      sky: SNOW_SKY,
      precipitation: 'snow',
      minDensity: 0.35,
      speed: 0.25,
      clouds: [0.7, 1],
      fog: 0.1,
    }))
    .with('HEAVY_SNOW', () => ({
      ...BASE_PROFILE,
      sky: SNOW_SKY,
      precipitation: 'snow',
      minDensity: 0.8,
      speed: 0.35,
      clouds: [0.9, 1],
      fog: 0.3,
      minWind: 0.35,
    }))
    .with('HAIL', () => ({
      ...BASE_PROFILE,
      sky: STORM_SKY,
      precipitation: 'hail',
      minDensity: 0.5,
      speed: 0.85,
      clouds: [0.85, 1],
      fog: 0.1,
      minWind: 0.2,
    }))
    .with('HOT', () => ({
      ...BASE_PROFILE,
      sky: { day: 'hotDay', night: 'hotNight' },
      clouds: [0, 0.15],
      atmosphere: 'heat',
      sun: 'blazing',
    }))
    .with('FRIGID', () => ({
      ...BASE_PROFILE,
      sky: { day: 'frigidDay', night: 'frigidNight' },
      clouds: [0, 0.15],
      atmosphere: 'frost',
    }))
    .exhaustive();
}

/** 기준 삭에서 지난 날수를 삭망월로 나눈 나머지로 그 시각의 위상(0~1)을 구한다. */
export function getMoonPhase(date: Date): number {
  const days = (date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS;
  const cycles = days / SYNODIC_MONTH_DAYS;
  return cycles - Math.floor(cycles);
}

/** 위상에서 밝게 보이는 면적 비율(0~1) */
export function getMoonIllumination(phase: number): number {
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return clamp(value, 0, 1);
}

function normalizePrecipitationIntensity(millimetersPerHour: number): number {
  if (!(millimetersPerHour > 0)) {
    return 0;
  }
  return clampUnit(Math.log1p(millimetersPerHour) / Math.log1p(HEAVY_PRECIPITATION_MM_PER_HOUR));
}

function normalizeWindSpeed(metersPerSecond: number): number {
  return clampUnit(metersPerSecond / STRONG_WIND_METERS_PER_SECOND);
}

function normalizeCloudCover(percent: number, range: readonly [number, number]): number {
  const [min, max] = range;
  if (Number.isNaN(percent)) {
    return min;
  }
  return clamp(percent / 100, min, max);
}

function precipitationAngle(wind: number): number {
  return clampUnit(wind) * WEATHER_SCENE_MAX_PRECIPITATION_ANGLE;
}

type OpenSky = Pick<WeatherScene, 'isDaylight' | 'clouds' | 'fog'> & { isDry: boolean };

function isSkyVisible(sky: OpenSky, maxClouds: number): boolean {
  return sky.isDry && sky.clouds < maxClouds && sky.fog < CELESTIAL_MAX_FOG;
}

/** 뿌연 하늘은 구름과 상관없이 흐릿한 해가 비친다. */
function resolveSun(sky: OpenSky, sun: VisibleSun): WeatherSceneSun {
  if (!sky.isDaylight) {
    return 'hidden';
  }
  if (sun === 'diffuse' || isSkyVisible(sky, SUN_MAX_CLOUDS)) {
    return sun;
  }
  return 'hidden';
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
  const sky: OpenSky = { ...atmosphere, isDry: isDry && !profile.lightning };
  const isNight = !input.isDaylight;
  const sun = resolveSun(sky, profile.sun);
  const moon = isNight && isSkyVisible(sky, MOON_MAX_CLOUDS);

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
    atmosphere: profile.atmosphere,
    lightning: profile.lightning,
    sun,
    lensFlare: profile.lensFlare && sun !== 'hidden',
    moon,
    moonPhase: getMoonPhase(input.observedAt),
    isSouthernHemisphere: input.latitude < 0,
    stars: isNight && isSkyVisible(sky, STARS_MAX_CLOUDS),
    shootingStars: moon && isSkyVisible(sky, SHOOTING_STARS_MAX_CLOUDS),
  };
}
