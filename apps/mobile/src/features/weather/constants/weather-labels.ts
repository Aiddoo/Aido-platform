import type {
  WeatherAirQualitySource,
  WeatherCondition,
  WeatherMoonPhase,
  WeatherPrecipitationType,
  WeatherPressureTrend,
} from '@aido/api';

import type {
  AirQualityGrade,
  CompassDirection,
  FeelsLikeComparison,
  UvLevel,
} from '../domains/weather-report.model';

export const WEATHER_CONDITION_LABEL_KEYS = {
  CLEAR: 'condition.clear',
  MOSTLY_CLEAR: 'condition.mostlyClear',
  PARTLY_CLOUDY: 'condition.partlyCloudy',
  MOSTLY_CLOUDY: 'condition.mostlyCloudy',
  CLOUDY: 'condition.cloudy',
  FOGGY: 'condition.foggy',
  HAZY: 'condition.hazy',
  WINDY: 'condition.windy',
  DRIZZLE: 'condition.drizzle',
  RAIN: 'condition.rain',
  HEAVY_RAIN: 'condition.heavyRain',
  THUNDERSTORMS: 'condition.thunderstorms',
  SLEET: 'condition.sleet',
  SNOW: 'condition.snow',
  HEAVY_SNOW: 'condition.heavySnow',
  HAIL: 'condition.hail',
  HOT: 'condition.hot',
  FRIGID: 'condition.frigid',
} as const satisfies Record<WeatherCondition, string>;

/** 분 단위 예보는 강수 형태가 NONE이어도 강수 구간일 수 있어 비로 읽는다. */
export const PRECIPITATION_SUBJECT_LABEL_KEYS = {
  NONE: 'precipitationSubject.rain',
  RAIN: 'precipitationSubject.rain',
  SNOW: 'precipitationSubject.snow',
  SLEET: 'precipitationSubject.sleet',
  HAIL: 'precipitationSubject.hail',
  MIXED: 'precipitationSubject.mixed',
} as const satisfies Record<WeatherPrecipitationType, string>;

export const UV_LEVEL_LABEL_KEYS = {
  low: 'uvLevel.low',
  moderate: 'uvLevel.moderate',
  high: 'uvLevel.high',
  veryHigh: 'uvLevel.veryHigh',
  extreme: 'uvLevel.extreme',
} as const satisfies Record<UvLevel, string>;

export const PRESSURE_TREND_LABEL_KEYS = {
  RISING: 'pressureTrend.rising',
  FALLING: 'pressureTrend.falling',
  STEADY: 'pressureTrend.steady',
} as const satisfies Record<WeatherPressureTrend, string>;

export const COMPASS_LABEL_KEYS = {
  n: 'compass.n',
  ne: 'compass.ne',
  e: 'compass.e',
  se: 'compass.se',
  s: 'compass.s',
  sw: 'compass.sw',
  w: 'compass.w',
  nw: 'compass.nw',
} as const satisfies Record<CompassDirection, string>;

export const MOON_PHASE_LABEL_KEYS = {
  NEW: 'moonPhase.new',
  WAXING_CRESCENT: 'moonPhase.waxingCrescent',
  FIRST_QUARTER: 'moonPhase.firstQuarter',
  WAXING_GIBBOUS: 'moonPhase.waxingGibbous',
  FULL: 'moonPhase.full',
  WANING_GIBBOUS: 'moonPhase.waningGibbous',
  THIRD_QUARTER: 'moonPhase.thirdQuarter',
  WANING_CRESCENT: 'moonPhase.waningCrescent',
} as const satisfies Record<WeatherMoonPhase, string>;

export const AIR_GRADE_LABEL_KEYS = {
  good: 'airGrade.good',
  moderate: 'airGrade.moderate',
  bad: 'airGrade.bad',
  veryBad: 'airGrade.veryBad',
} as const satisfies Record<AirQualityGrade, string>;

export const FEELS_LIKE_LABEL_KEYS = {
  colder: 'details.feelsColder',
  similar: 'details.feelsSimilar',
  warmer: 'details.feelsWarmer',
} as const satisfies Record<FeelsLikeComparison, string>;

/** 공공데이터(에어코리아) 이용 조건: 대기질을 보여 주는 곳에 출처를 함께 표기한다. */
export const AIR_QUALITY_SOURCE_LABEL_KEYS = {
  AIRKOREA: 'airQualitySource.AIRKOREA',
} as const satisfies Record<WeatherAirQualitySource, string>;
