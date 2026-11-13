import type {
  WeatherCondition,
  WeatherPrecipitationType,
  WeatherRescheduleReason,
} from '@aido/api/vocabulary';

import type { CompassDirection } from '../domains/weather-indicator.model';

const WEATHER_CONDITION_LABEL_KEYS = {
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

export function getWeatherConditionLabelKey(condition: WeatherCondition) {
  return WEATHER_CONDITION_LABEL_KEYS[condition];
}

/** 분 단위 예보는 강수 형태가 NONE이어도 강수 구간일 수 있어 비로 읽는다. */
const PRECIPITATION_SUBJECT_LABEL_KEYS = {
  NONE: 'precipitationSubject.rain',
  RAIN: 'precipitationSubject.rain',
  SNOW: 'precipitationSubject.snow',
  SLEET: 'precipitationSubject.sleet',
  HAIL: 'precipitationSubject.hail',
  MIXED: 'precipitationSubject.mixed',
} as const satisfies Record<WeatherPrecipitationType, string>;

export function getPrecipitationSubjectLabelKey(precipitationType: WeatherPrecipitationType) {
  return PRECIPITATION_SUBJECT_LABEL_KEYS[precipitationType];
}

/** 다이얼처럼 좁은 자리에는 한두 글자 방위를 쓴다. */
const COMPASS_SHORT_LABEL_KEYS = {
  n: 'compassShort.n',
  ne: 'compassShort.ne',
  e: 'compassShort.e',
  se: 'compassShort.se',
  s: 'compassShort.s',
  sw: 'compassShort.sw',
  w: 'compassShort.w',
  nw: 'compassShort.nw',
} as const satisfies Record<CompassDirection, string>;

export function getCompassShortLabelKey(direction: CompassDirection) {
  return COMPASS_SHORT_LABEL_KEYS[direction];
}

/** 옮기기 시트의 이유별 문구. 후보 설명은 넣는 값이 달라 화면이 따로 고른다. */
const RESCHEDULE_COPY_KEYS = {
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

export function getRescheduleCopyKeys(reason: WeatherRescheduleReason) {
  return RESCHEDULE_COPY_KEYS[reason];
}
