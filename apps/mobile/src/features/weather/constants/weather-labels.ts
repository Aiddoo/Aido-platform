import type { WeatherRescheduleReason } from '@aido/api';
import type {
  WeatherAirQualitySource,
  WeatherCondition,
  WeatherMoonPhase,
  WeatherPrecipitationType,
  WeatherPressureTrend,
} from '@aido/api';

import type {
  CloudCoverLevel,
  CloudCoverNote,
  NextSunEvent,
  VisibilityLevel,
  WindLevel,
} from '../domains/weather-detail.model';
import type { HourlySky } from '../domains/weather-hourly.model';
import type {
  AirQualityGrade,
  CompassDirection,
  FeelsLikeComparison,
  UvLevel,
} from '../domains/weather-report.model';
import type { PrecipitationLevel } from '../utils/view-models/next-hour-chart.view-model';

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

export const FEELS_LIKE_NOTE_KEYS = {
  colder: 'details.feelsColderNote',
  similar: 'details.feelsSimilarNote',
  warmer: 'details.feelsWarmerNote',
} as const satisfies Record<FeelsLikeComparison, string>;

export const VISIBILITY_LEVEL_LABEL_KEYS = {
  clear: 'details.visibilityClear',
  moderate: 'details.visibilityModerate',
  poor: 'details.visibilityPoor',
} as const satisfies Record<VisibilityLevel, string>;

export const CLOUD_COVER_LEVEL_LABEL_KEYS = {
  overcast: 'details.cloudOvercast',
  mostlyCloudy: 'details.cloudMostlyCloudy',
  mostlyClear: 'details.cloudMostlyClear',
} as const satisfies Record<CloudCoverLevel, string>;

export const SUN_EVENT_LABEL_KEYS = {
  sunrise: 'sunMoon.sunrise',
  sunset: 'sunMoon.sunset',
  sunriseTomorrow: 'sunMoon.sunriseTomorrow',
} as const satisfies Record<NextSunEvent['kind'], string>;

/** 다이얼처럼 좁은 자리에는 한두 글자 방위를 쓴다. */
export const COMPASS_SHORT_LABEL_KEYS = {
  n: 'compassShort.n',
  ne: 'compassShort.ne',
  e: 'compassShort.e',
  se: 'compassShort.se',
  s: 'compassShort.s',
  sw: 'compassShort.sw',
  w: 'compassShort.w',
  nw: 'compassShort.nw',
} as const satisfies Record<CompassDirection, string>;

export const WIND_LEVEL_NOTE_KEYS = {
  calm: 'details.windCalm',
  breeze: 'details.windBreeze',
  strong: 'details.windStrong',
} as const satisfies Record<WindLevel, string>;

export const CLOUD_COVER_NOTE_KEYS = {
  overcast: 'details.cloudOvercastNote',
  brokenDay: 'details.cloudBrokenDayNote',
  brokenNight: 'details.cloudBrokenNightNote',
  clearDay: 'details.cloudClearDayNote',
  clearNight: 'details.cloudClearNightNote',
} as const satisfies Record<CloudCoverNote, string>;

export const SKY_BEFORE_KEYS = {
  clear: 'hourly.summary.skyBefore.clear',
  partlyCloudy: 'hourly.summary.skyBefore.partlyCloudy',
  cloudy: 'hourly.summary.skyBefore.cloudy',
  hazy: 'hourly.summary.skyBefore.hazy',
} as const satisfies Record<HourlySky, string>;

export const SKY_AFTER_KEYS = {
  clear: 'hourly.summary.skyAfter.clear',
  partlyCloudy: 'hourly.summary.skyAfter.partlyCloudy',
  cloudy: 'hourly.summary.skyAfter.cloudy',
  hazy: 'hourly.summary.skyAfter.hazy',
} as const satisfies Record<HourlySky, string>;

export const SKY_STEADY_KEYS = {
  clear: 'hourly.summary.steady.clear',
  partlyCloudy: 'hourly.summary.steady.partlyCloudy',
  cloudy: 'hourly.summary.steady.cloudy',
  hazy: 'hourly.summary.steady.hazy',
} as const satisfies Record<HourlySky, string>;

export const PRECIPITATION_LEVEL_LABEL_KEYS = {
  light: 'nextHour.level.light',
  moderate: 'nextHour.level.moderate',
  heavy: 'nextHour.level.heavy',
} as const satisfies Record<PrecipitationLevel, string>;

/** 옮기기 시트의 이유별 문구. 후보 설명은 넣는 값이 달라 화면이 따로 고른다. */
export const RESCHEDULE_COPY_KEYS = {
  rain: {
    title: 'reschedule.title',
    description: 'reschedule.description',
    noTime: 'reschedule.noDryTime',
  },
  heat: {
    title: 'reschedule.heat.title',
    description: 'reschedule.heat.description',
    noTime: 'reschedule.heat.noCoolTime',
  },
} as const satisfies Record<
  WeatherRescheduleReason,
  Record<'title' | 'description' | 'noTime', string>
>;
