import { z } from "zod";

/**
 * WeatherKit REST `GET /api/v1/weather` 응답 중 사용하는 필드.
 *
 * nullish 필드는 Apple이 생략하거나 null로 보내는 값(돌풍·풍향·일출입·월출몰·낮/밤 예보 등)이며,
 * mapper는 이를 0 같은 기본값이 아닌 null(알 수 없음)로 옮긴다.
 *
 * 지역마다 제공 dataset이 달라 dataset은 모두 optional이고, 부가 dataset 형태가 깨지면 그
 * dataset만 버린다. enum 값은 Apple이 늘릴 수 있어 문자열로 받고 mapper가 안전한 값으로 좁힌다.
 */
const CONDITION_CODES = [
  "Blizzard",
  "BlowingDust",
  "BlowingSnow",
  "Breezy",
  "Clear",
  "Cloudy",
  "Drizzle",
  "Dust",
  "Flurries",
  "Fog",
  "FreezingDrizzle",
  "FreezingRain",
  "Frigid",
  "Hail",
  "Haze",
  "HeavyRain",
  "HeavySnow",
  "Hot",
  "Hurricane",
  "IsolatedThunderstorms",
  "MixedRainAndSleet",
  "MixedRainAndSnow",
  "MixedRainfall",
  "MixedSnowAndSleet",
  "MostlyClear",
  "MostlyCloudy",
  "PartlyCloudy",
  "Rain",
  "ScatteredShowers",
  "ScatteredSnowShowers",
  "ScatteredThunderstorms",
  "SevereThunderstorm",
  "Showers",
  "Sleet",
  "Smoke",
  "Snow",
  "SnowShowers",
  "StrongStorms",
  "SunFlurries",
  "SunShowers",
  "Thunderstorm",
  "Thunderstorms",
  "TropicalStorm",
  "Tornado",
  "WintryMix",
  "Windy",
] as const;

const PRECIPITATION_TYPES = [
  "clear",
  "precipitation",
  "rain",
  "snow",
  "sleet",
  "hail",
  "mixed",
] as const;
const PRESSURE_TRENDS = ["rising", "falling", "steady"] as const;
const MOON_PHASES = [
  "new",
  "waxingCrescent",
  "firstQuarter",
  "waxingGibbous",
  "full",
  "waningGibbous",
  "thirdQuarter",
  "waningCrescent",
] as const;
const ALERT_SEVERITIES = ["extreme", "severe", "moderate", "minor", "unknown"] as const;

export type WeatherKitConditionCode = (typeof CONDITION_CODES)[number];
export type WeatherKitPrecipitationType = (typeof PRECIPITATION_TYPES)[number];
export type WeatherKitPressureTrend = (typeof PRESSURE_TRENDS)[number];
export type WeatherKitMoonPhase = (typeof MOON_PHASES)[number];
export type WeatherKitAlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** 알려진 값은 그 리터럴로, 새 값은 null로 받아 mapper가 기본값을 고른다. */
function knownValue<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((value): T[number] | null => values.find((known) => known === value) ?? null);
}

const conditionCodeSchema = knownValue(CONDITION_CODES);
const precipitationTypeSchema = knownValue(PRECIPITATION_TYPES);

const instantSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const currentWeatherSchema = z.looseObject({
  metadata: z.looseObject({ readTime: instantSchema.nullish() }).optional().catch(undefined),
  asOf: instantSchema,
  cloudCover: z.number(),
  conditionCode: conditionCodeSchema,
  daylight: z.boolean(),
  humidity: z.number(),
  precipitationIntensity: z.number(),
  pressure: z.number(),
  pressureTrend: knownValue(PRESSURE_TRENDS),
  temperature: z.number(),
  temperatureApparent: z.number(),
  temperatureDewPoint: z.number(),
  uvIndex: z.number(),
  visibility: z.number(),
  windDirection: z.number().nullish(),
  windGust: z.number().nullish(),
  windSpeed: z.number(),
});

const nextHourSchema = z.looseObject({
  summary: z.array(
    z.looseObject({
      startTime: instantSchema,
      endTime: instantSchema.nullish(),
      condition: precipitationTypeSchema,
      precipitationChance: z.number(),
      precipitationIntensity: z.number(),
    }),
  ),
  minutes: z.array(
    z.looseObject({
      startTime: instantSchema,
      precipitationChance: z.number(),
      precipitationIntensity: z.number(),
    }),
  ),
});

const hourSchema = z.looseObject({
  forecastStart: instantSchema,
  conditionCode: conditionCodeSchema,
  daylight: z.boolean(),
  humidity: z.number(),
  precipitationAmount: z.number(),
  precipitationChance: z.number(),
  precipitationType: precipitationTypeSchema,
  temperature: z.number(),
  temperatureApparent: z.number(),
  uvIndex: z.number(),
  windDirection: z.number().nullish(),
  windSpeed: z.number(),
});

const dayPartSchema = z.looseObject({
  conditionCode: conditionCodeSchema,
  precipitationAmount: z.number(),
  precipitationChance: z.number(),
  precipitationType: precipitationTypeSchema,
  temperatureMax: z.number().nullish(),
  temperatureMin: z.number().nullish(),
});

const daySchema = z.looseObject({
  forecastStart: instantSchema,
  conditionCode: conditionCodeSchema,
  maxUvIndex: z.number(),
  moonPhase: knownValue(MOON_PHASES),
  precipitationAmount: z.number(),
  precipitationChance: z.number(),
  precipitationType: precipitationTypeSchema,
  snowfallAmount: z.number(),
  sunrise: instantSchema.nullish(),
  sunset: instantSchema.nullish(),
  moonrise: instantSchema.nullish(),
  moonset: instantSchema.nullish(),
  temperatureMax: z.number(),
  temperatureMin: z.number(),
  windGustSpeedMax: z.number().nullish(),
  windSpeedMax: z.number().nullish(),
  restOfDayForecast: dayPartSchema.nullish().catch(undefined),
  daytimeForecast: dayPartSchema.nullish().catch(undefined),
  overnightForecast: dayPartSchema.nullish().catch(undefined),
});

const alertSchema = z.looseObject({
  id: z.string(),
  description: z.string(),
  severity: knownValue(ALERT_SEVERITIES),
  source: z.string(),
  areaName: z.string().nullish(),
  effectiveTime: instantSchema,
  expireTime: instantSchema,
  detailsUrl: z.url(),
});

export const weatherKitWeatherSchema = z.looseObject({
  currentWeather: currentWeatherSchema.optional(),
  forecastNextHour: nextHourSchema.optional().catch(undefined),
  forecastHourly: z
    .object({ hours: z.array(hourSchema) })
    .optional()
    .catch(undefined),
  forecastDaily: z
    .object({ days: z.array(daySchema) })
    .optional()
    .catch(undefined),
  weatherAlerts: z
    .object({ alerts: z.array(alertSchema) })
    .optional()
    .catch(undefined),
});

export type WeatherKitWeather = z.infer<typeof weatherKitWeatherSchema>;
export type WeatherKitCurrentWeather = z.infer<typeof currentWeatherSchema>;
export type WeatherKitNextHour = z.infer<typeof nextHourSchema>;
export type WeatherKitHour = z.infer<typeof hourSchema>;
export type WeatherKitDay = z.infer<typeof daySchema>;
export type WeatherKitDayPart = z.infer<typeof dayPartSchema>;
export type WeatherKitAlert = z.infer<typeof alertSchema>;
