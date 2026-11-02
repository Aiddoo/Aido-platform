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
