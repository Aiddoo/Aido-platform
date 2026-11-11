export const SKY_CONDITION = {
  CLEAR: "CLEAR",
  PARTLY_CLOUDY: "PARTLY_CLOUDY",
  CLOUDY: "CLOUDY",
} as const;

export type SkyCondition = (typeof SKY_CONDITION)[keyof typeof SKY_CONDITION];

export const SKY_CONDITIONS = ["CLEAR", "PARTLY_CLOUDY", "CLOUDY"] as const;

export const PRECIPITATION_TYPE = {
  NONE: "NONE",
  RAIN: "RAIN",
  RAIN_SNOW: "RAIN_SNOW",
  SNOW: "SNOW",
  SHOWER: "SHOWER",
} as const;

export type PrecipitationType = (typeof PRECIPITATION_TYPE)[keyof typeof PRECIPITATION_TYPE];

export const PRECIPITATION_TYPES = ["NONE", "RAIN", "RAIN_SNOW", "SNOW", "SHOWER"] as const;

/** 한국 위도 범위 (WGS84) */
export const LATITUDE_RANGE = {
  MIN: 33.0,
  MAX: 39.0,
} as const;

/** 한국 경도 범위 (WGS84) */
export const LONGITUDE_RANGE = {
  MIN: 124.0,
  MAX: 132.0,
} as const;

export const WEATHER_CONDITIONS = [
  "CLEAR",
  "MOSTLY_CLEAR",
  "PARTLY_CLOUDY",
  "MOSTLY_CLOUDY",
  "CLOUDY",
  "FOGGY",
  "HAZY",
  "WINDY",
  "DRIZZLE",
  "RAIN",
  "HEAVY_RAIN",
  "THUNDERSTORMS",
  "SLEET",
  "SNOW",
  "HEAVY_SNOW",
  "HAIL",
  "HOT",
  "FRIGID",
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const WEATHER_PRECIPITATION_TYPES = [
  "NONE",
  "RAIN",
  "SNOW",
  "SLEET",
  "HAIL",
  "MIXED",
] as const;

export type WeatherPrecipitationType = (typeof WEATHER_PRECIPITATION_TYPES)[number];

export const WEATHER_PRESSURE_TRENDS = ["RISING", "FALLING", "STEADY"] as const;

export type WeatherPressureTrend = (typeof WEATHER_PRESSURE_TRENDS)[number];

export const WEATHER_MOON_PHASES = [
  "NEW",
  "WAXING_CRESCENT",
  "FIRST_QUARTER",
  "WAXING_GIBBOUS",
  "FULL",
  "WANING_GIBBOUS",
  "THIRD_QUARTER",
  "WANING_CRESCENT",
] as const;

export type WeatherMoonPhase = (typeof WEATHER_MOON_PHASES)[number];

export const WEATHER_ALERT_SEVERITIES = [
  "EXTREME",
  "SEVERE",
  "MODERATE",
  "MINOR",
  "UNKNOWN",
] as const;

export type WeatherAlertSeverity = (typeof WEATHER_ALERT_SEVERITIES)[number];

export const WEATHER_NEXT_HOUR_CONDITIONS = ["CLEAR", "PRECIPITATION"] as const;

export type WeatherNextHourCondition = (typeof WEATHER_NEXT_HOUR_CONDITIONS)[number];

export const WEATHER_PROVIDERS = ["APPLE_WEATHER"] as const;

export const WEATHER_AIR_QUALITY_SOURCES = ["AIRKOREA"] as const;

export type WeatherAirQualitySource = (typeof WEATHER_AIR_QUALITY_SOURCES)[number];

export type WeatherProvider = (typeof WEATHER_PROVIDERS)[number];

export const GLOBAL_LATITUDE_RANGE = {
  MIN: -90,
  MAX: 90,
} as const;

export const GLOBAL_LONGITUDE_RANGE = {
  MIN: -180,
  MAX: 180,
} as const;

export const WEATHER_REPORT_LIMITS = {
  HOURLY_FORECAST_HOURS: 24,
  DAILY_FORECAST_DAYS: 10,
} as const;

/**
 * 앱 브리핑과 날씨 푸시가 같은 판단을 내리도록 공유하는 기준.
 * 시간별 강수 확률(%)이 WET_HOUR_CHANCE 이상이면 비 오는 시간, 낮 체감 온도(°C)가 HOT_APPARENT_TEMPERATURE 이상이면 더운 시간,
 * 일 최저 기온(°C)이 CHILLY_TEMPERATURE 이하면 쌀쌀한 날로 본다.
 * 하루는 MORNING_START_HOUR 전이 새벽, AFTERNOON_START_HOUR 전이 오전, EVENING_HOUR 전이 오후, 그 뒤가 저녁이다(위치 시간대).
 */
export const WEATHER_BRIEFING_RULES = {
  WET_HOUR_CHANCE: 50,
  HOT_APPARENT_TEMPERATURE: 33,
  CHILLY_TEMPERATURE: 10,
  MORNING_START_HOUR: 6,
  AFTERNOON_START_HOUR: 12,
  EVENING_HOUR: 18,
} as const;

/** 눈으로 보는 강수 형태. 앱 브리핑과 날씨 푸시가 같은 기준으로 눈 소식을 고른다. */
export const WEATHER_FROZEN_PRECIPITATION_TYPES = [
  "SNOW",
  "SLEET",
  "HAIL",
] as const satisfies readonly WeatherPrecipitationType[];

/** 날씨와 겹친 할 일을 옮기는 앱 경로. 날씨 푸시의 `DEEP_LINK` url과 앱 링크가 함께 쓴다. */
export const WEATHER_RESCHEDULE_DEEP_LINK = "/weather/reschedule";

/** 옮기기 화면이 무엇을 피해 옮길지. 모르는 값은 앱이 rain으로 읽는다. */
export const WEATHER_RESCHEDULE_REASONS = ["rain", "heat"] as const;

export type WeatherRescheduleReason = (typeof WEATHER_RESCHEDULE_REASONS)[number];

/** 옮기기 링크에 싣는 할 일 수의 상한. 앱은 이보다 많은 id를 받으면 링크를 버리고, 서버 actionUrl은 1000자까지다. */
export const WEATHER_RESCHEDULE_MAX_TODO_IDS = 50;

/**
 * `/weather/reschedule?todoIds=12,15&reason=rain`. id는 양의 정수, reason은 고정 값이라 인코딩하지 않는다.
 * 할 일은 앞에서부터 `WEATHER_RESCHEDULE_MAX_TODO_IDS`개만 싣는다.
 */
export function buildWeatherRescheduleDeepLink(
  todoIds: readonly number[],
  reason: WeatherRescheduleReason,
): string {
  const ids = todoIds.slice(0, WEATHER_RESCHEDULE_MAX_TODO_IDS).join(",");
  return `${WEATHER_RESCHEDULE_DEEP_LINK}?todoIds=${ids}&reason=${reason}`;
}
