import { z } from "zod";

import { dateSchema, datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import {
  WEATHER_AIR_QUALITY_SOURCES,
  WEATHER_ALERT_SEVERITIES,
  WEATHER_CONDITIONS,
  WEATHER_MOON_PHASES,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  WEATHER_PRESSURE_TRENDS,
  WEATHER_PROVIDERS,
  WEATHER_REPORT_LIMITS,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  WEATHER_RESCHEDULE_REASONS,
} from "../../../vocabulary/weather.constants.js";

const percentSchema = z.number().int().min(0).max(100);

// 앞으로 더할 열거 값은 출시된 앱이 리포트를 버리지 않게 그 칸만 대체값으로 읽는다(compatibility.md). 서버 응답 값은 같다
/** 흐림: 아이콘·장면이 있고 비·눈·더위·서리 효과나 경고를 만들지 않는다 */
const weatherConditionSchema = z.enum(WEATHER_CONDITIONS).catch("CLOUDY");
/** 섞임: 강수 확률이 높은 시간에만 "비나 눈"으로 말하고 마른 시간에는 보이지 않는다 */
const weatherPrecipitationTypeSchema = z.enum(WEATHER_PRECIPITATION_TYPES).catch("MIXED");
const timezoneSchema = z.string().min(1).max(50).describe("IANA 시간대 (예: Asia/Seoul)");

export const weatherLocationSchema = z.object({
  latitude: z.number().describe("위도 (WGS84)"),
  longitude: z.number().describe("경도 (WGS84)"),
  timezone: timezoneSchema,
});

export type WeatherLocationResponse = z.infer<typeof weatherLocationSchema>;

export const weatherCurrentConditionsSchema = z.object({
  observedAt: datetimeSchema.describe("관측 시각"),
  condition: weatherConditionSchema.describe("날씨 상태"),
  isDaylight: z.boolean().describe("관측 시각이 낮인지 여부"),
  temperature: z.number().describe("기온 (°C)"),
  apparentTemperature: z.number().describe("체감 온도 (°C)"),
  dewPoint: z.number().describe("이슬점 (°C)"),
  humidity: percentSchema.describe("상대 습도 (%)"),
  cloudCover: percentSchema.describe("운량 (%)"),
  uvIndex: z.number().int().min(0).describe("자외선 지수"),
  windSpeed: z.number().min(0).describe("풍속 (m/s)"),
  windGust: z.number().min(0).nullable().describe("돌풍 (m/s)"),
  windDirection: z.number().int().min(0).max(359).nullable().describe("풍향 (도, 북=0)"),
  visibility: z.number().min(0).describe("가시거리 (m)"),
  pressure: z.number().min(0).describe("해면기압 (hPa)"),
  pressureTrend: z.enum(WEATHER_PRESSURE_TRENDS).catch("STEADY").describe("기압 추세"),
  precipitationIntensity: z.number().min(0).describe("강수 강도 (mm/h)"),
});

export type WeatherCurrentConditions = z.infer<typeof weatherCurrentConditionsSchema>;

export const weatherMinuteForecastSchema = z.object({
  startsAt: datetimeSchema.describe("분 단위 구간 시작 시각"),
  precipitationChance: percentSchema.describe("강수 확률 (%)"),
  precipitationIntensity: z.number().min(0).describe("강수 강도 (mm/h)"),
});

export type WeatherMinuteForecast = z.infer<typeof weatherMinuteForecastSchema>;

export const weatherNextHourPeriodSchema = z.object({
  condition: z.enum(WEATHER_NEXT_HOUR_CONDITIONS).describe("구간 상태"),
  precipitationType: z
    .enum(WEATHER_PRECIPITATION_TYPES)
    .nullable()
    .catch(null)
    .describe("강수 형태. 맑음 구간은 NONE, 공급자가 형태 없이 '강수'로만 알리면 null"),
  startsAt: datetimeSchema.describe("구간 시작 시각"),
  endsAt: nullableDatetimeSchema.describe("구간 끝 시각. 예보 범위 끝까지 이어지면 null"),
  precipitationChance: percentSchema.describe("구간 최대 강수 확률 (%)"),
  precipitationIntensity: z.number().min(0).describe("구간 최대 강수 강도 (mm/h)"),
});

export type WeatherNextHourPeriod = z.infer<typeof weatherNextHourPeriodSchema>;

export const weatherNextHourSchema = z.object({
  periods: z.array(weatherNextHourPeriodSchema).describe("맑음·강수가 바뀌는 구간 요약"),
  minutes: z
    .array(weatherMinuteForecastSchema)
    .describe("지금부터 공급자 예보 끝(최대 약 90분)까지 1분 간격"),
});

export type WeatherNextHour = z.infer<typeof weatherNextHourSchema>;

export const weatherHourlyForecastSchema = z.object({
  startsAt: datetimeSchema.describe("시간 구간 시작 시각"),
  condition: weatherConditionSchema.describe("날씨 상태"),
  isDaylight: z.boolean().describe("낮인지 여부"),
  temperature: z.number().describe("기온 (°C)"),
  apparentTemperature: z.number().describe("체감 온도 (°C)"),
  humidity: percentSchema.describe("상대 습도 (%)"),
  uvIndex: z.number().int().min(0).describe("자외선 지수"),
  windSpeed: z.number().min(0).describe("풍속 (m/s)"),
  windDirection: z.number().int().min(0).max(359).nullable().describe("풍향 (도, 북=0)"),
  precipitationChance: percentSchema.describe("강수 확률 (%)"),
  precipitationAmount: z.number().min(0).describe("강수량 (mm)"),
  precipitationType: weatherPrecipitationTypeSchema.describe("강수 형태"),
});

export type WeatherHourlyForecast = z.infer<typeof weatherHourlyForecastSchema>;

export const weatherDayPartForecastSchema = z.object({
  condition: weatherConditionSchema.describe("날씨 상태"),
  temperatureMin: z.number().nullable().describe("최저 기온 (°C)"),
  temperatureMax: z.number().nullable().describe("최고 기온 (°C)"),
  precipitationChance: percentSchema.describe("강수 확률 (%)"),
  precipitationAmount: z.number().min(0).describe("강수량 (mm)"),
  precipitationType: weatherPrecipitationTypeSchema.describe("강수 형태"),
});

export type WeatherDayPartForecast = z.infer<typeof weatherDayPartForecastSchema>;

export const weatherDailyForecastSchema = z.object({
  date: dateSchema.describe("위치 시간대 기준 날짜"),
  condition: weatherConditionSchema.describe("날씨 상태"),
  temperatureMin: z.number().describe("최저 기온 (°C)"),
  temperatureMax: z.number().describe("최고 기온 (°C)"),
  precipitationChance: percentSchema.describe("강수 확률 (%)"),
  precipitationAmount: z.number().min(0).describe("강수량 (mm)"),
  precipitationType: weatherPrecipitationTypeSchema.describe("강수 형태"),
  snowfallAmount: z.number().min(0).describe("적설량 (mm, 물 환산 전 눈 깊이)"),
  uvIndexMax: z.number().int().min(0).describe("최고 자외선 지수"),
  windSpeedMax: z.number().min(0).nullable().describe("최대 풍속 (m/s)"),
  windGustMax: z.number().min(0).nullable().describe("최대 돌풍 (m/s)"),
  sunrise: nullableDatetimeSchema.describe("일출 시각 (극야면 null)"),
  sunset: nullableDatetimeSchema.describe("일몰 시각 (백야면 null)"),
  moonPhase: z.enum(WEATHER_MOON_PHASES).catch("NEW").describe("달 위상"),
  moonrise: nullableDatetimeSchema.describe("월출 시각 (그날 뜨지 않으면 null)"),
  moonset: nullableDatetimeSchema.describe("월몰 시각 (그날 지지 않으면 null)"),
  restOfDay: weatherDayPartForecastSchema
    .nullable()
    .describe("지금부터 그날 끝까지 예보. 오늘 항목에만 있고 나머지는 null"),
  daytime: weatherDayPartForecastSchema.nullable().describe("낮(07~19시) 예보"),
  overnight: weatherDayPartForecastSchema.nullable().describe("밤(19~다음 날 07시) 예보"),
});

export type WeatherDailyForecast = z.infer<typeof weatherDailyForecastSchema>;

export const weatherAirQualitySchema = z.object({
  pm10: z.number().min(0).nullable().describe("미세먼지 (μg/m³)"),
  pm25: z.number().min(0).nullable().describe("초미세먼지 (μg/m³)"),
  source: z.enum(WEATHER_AIR_QUALITY_SOURCES).describe("대기질 출처. 화면에 출처를 함께 표기한다"),
});

export type WeatherAirQuality = z.infer<typeof weatherAirQualitySchema>;

export const weatherAlertSchema = z.object({
  id: z.string().describe("공급자 특보 ID"),
  title: z.string().describe("특보 이름 (요청 언어로 번역됨)"),
  severity: z.enum(WEATHER_ALERT_SEVERITIES).catch("UNKNOWN").describe("심각도"),
  source: z.string().describe("발표 기관"),
  areaName: z.string().nullable().describe("대상 지역 이름"),
  effectiveAt: datetimeSchema.describe("발효 시각"),
  expiresAt: datetimeSchema.describe("만료 시각"),
  detailsUrl: z.url().describe("공급자 상세 페이지"),
});

export type WeatherAlert = z.infer<typeof weatherAlertSchema>;

const weatherAttributionLogoSchema = z.object({
  "1x": z.url(),
  "2x": z.url(),
  "3x": z.url(),
});

export const weatherAttributionSchema = z.object({
  provider: z.enum(WEATHER_PROVIDERS).describe("데이터 공급자"),
  serviceName: z.string().describe("공급자 서비스 표기 (예: Apple Weather)"),
  legalPageUrl: z
    .url()
    .describe("공급자 데이터 출처 고지 페이지. 로고와 함께 링크로 노출해야 한다"),
  logo: z
    .object({
      light: weatherAttributionLogoSchema.describe("밝은 배경용 로고 (검은 글자)"),
      dark: weatherAttributionLogoSchema.describe("어두운 배경용 로고 (흰 글자)"),
    })
    .nullable()
    .describe(
      "공급자 로고. 크기를 줄이거나 변형하지 않고 1x 크기 이상으로 표시한다. 받지 못하면 null",
    ),
});

export type WeatherAttribution = z.infer<typeof weatherAttributionSchema>;

export const weatherRescheduleOptionSchema = z.object({
  startsAt: datetimeSchema.describe("옮길 시각 후보. 같은 날(요청 시간대)의 시간별 예보 시작 시각"),
  precipitationChance: percentSchema.describe("그 시간의 강수 확률 (%)"),
  apparentTemperature: z.number().describe("그 시간의 체감 온도 (°C)"),
  isRecommended: z.boolean().describe("서버가 가장 낫다고 고른 후보. 목록의 첫 항목이다"),
});

export type WeatherRescheduleOption = z.infer<typeof weatherRescheduleOptionSchema>;

export const weatherBriefingSchema = z.object({
  reason: z
    .enum(WEATHER_RESCHEDULE_REASONS)
    .nullable()
    .catch(null)
    .describe("영향받는 할 일이 있을 때 무엇을 피해 옮길지. 비·눈(rain)이 더위(heat)보다 먼저다"),
  affectedTodoIds: z
    .array(z.number().int().positive())
    .max(WEATHER_RESCHEDULE_MAX_TODO_IDS)
    .describe(
      "오늘 남은 시간 중 시각이 정해진 미완료 할 일에서 날씨와 겹친 할 일 id. 시각이 이른 순이며 날씨 푸시와 같은 기준이다",
    ),
  rescheduleOptions: z
    .array(
      z.object({
        todoId: z.number().int().positive(),
        options: z.array(weatherRescheduleOptionSchema).max(4),
      }),
    )
    .describe("affectedTodoIds의 각 할 일을 옮길 시간 후보(최대 4개, 첫 항목이 추천)"),
});

export type WeatherBriefing = z.infer<typeof weatherBriefingSchema>;

export const weatherReportSchema = z
  .object({
    location: weatherLocationSchema,
    current: weatherCurrentConditionsSchema,
    nextHour: weatherNextHourSchema
      .nullable()
      .describe("분 단위 강수 예보. 지원하지 않는 지역은 null"),
    hourly: z
      .array(weatherHourlyForecastSchema)
      .max(WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS)
      .describe("현재 시각이 속한 시간부터 최대 24시간"),
    daily: z
      .array(weatherDailyForecastSchema)
      .max(WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS)
      .describe("오늘부터 최대 10일"),
    alerts: z.array(weatherAlertSchema).describe("발효 중인 기상 특보. 심각도 높은 순"),
    // 모르는 출처를 다른 기관 이름으로 표기하지 않도록 대기질 칸째 없는 지역처럼 읽는다
    airQuality: weatherAirQualitySchema
      .nullable()
      .catch(null)
      .describe("대기질. 제공하지 않는 지역은 null"),
    attribution: weatherAttributionSchema,
    fetchedAt: datetimeSchema.describe(
      "공급자에서 데이터를 받은 시각. 공급자 장애 때는 마지막 성공 시각",
    ),
    briefing: weatherBriefingSchema
      .optional()
      .describe(
        "영향받는 할 일과 옮길 시간 후보(서버가 판단). 오늘 할 일을 읽지 못하면 빠진다. 1.15.1에서 추가했다",
      ),
  })
  .meta({
    example: {
      location: { latitude: 37.5636, longitude: 126.9976, timezone: "Asia/Seoul" },
      current: {
        observedAt: "2026-11-02T06:26:00.000Z",
        condition: "RAIN",
        isDaylight: true,
        temperature: 12.4,
        apparentTemperature: 9.1,
        dewPoint: 10.5,
        humidity: 88,
        cloudCover: 100,
        uvIndex: 1,
        windSpeed: 4.6,
        windGust: 9.2,
        windDirection: 315,
        visibility: 8000,
        pressure: 1012.3,
        pressureTrend: "FALLING",
        precipitationIntensity: 1.2,
      },
      nextHour: {
        periods: [
          {
            condition: "PRECIPITATION",
            precipitationType: "RAIN",
            startsAt: "2026-11-02T06:43:00.000Z",
            endsAt: null,
            precipitationChance: 80,
            precipitationIntensity: 2.4,
          },
        ],
        minutes: [
          {
            startsAt: "2026-11-02T06:26:00.000Z",
            precipitationChance: 20,
            precipitationIntensity: 0,
          },
        ],
      },
      hourly: [
        {
          startsAt: "2026-11-02T06:00:00.000Z",
          condition: "RAIN",
          isDaylight: true,
          temperature: 12.4,
          apparentTemperature: 9.1,
          humidity: 88,
          uvIndex: 1,
          windSpeed: 4.6,
          windDirection: 315,
          precipitationChance: 60,
          precipitationAmount: 0.8,
          precipitationType: "RAIN",
        },
      ],
      daily: [
        {
          date: "2026-11-02",
          condition: "RAIN",
          temperatureMin: 8,
          temperatureMax: 14,
          precipitationChance: 80,
          precipitationAmount: 6.5,
          precipitationType: "RAIN",
          snowfallAmount: 0,
          uvIndexMax: 2,
          windSpeedMax: 6.1,
          windGustMax: 11.4,
          sunrise: "2026-11-01T21:51:00.000Z",
          sunset: "2026-11-02T08:28:00.000Z",
          moonPhase: "THIRD_QUARTER",
          moonrise: null,
          moonset: "2026-11-02T04:50:15.000Z",
          restOfDay: null,
          daytime: {
            condition: "RAIN",
            temperatureMin: 10,
            temperatureMax: 14,
            precipitationChance: 80,
            precipitationAmount: 5.1,
            precipitationType: "RAIN",
          },
          overnight: {
            condition: "CLOUDY",
            temperatureMin: 8,
            temperatureMax: 11,
            precipitationChance: 30,
            precipitationAmount: 1.4,
            precipitationType: "RAIN",
          },
        },
      ],
      alerts: [],
      airQuality: { pm10: 32, pm25: 18, source: "AIRKOREA" },
      attribution: {
        provider: "APPLE_WEATHER",
        serviceName: "Apple Weather",
        legalPageUrl: "https://developer.apple.com/weatherkit/data-source-attribution/",
        logo: {
          light: {
            "1x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_1X_090122.png",
            "2x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_2X_090122.png",
            "3x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_3X_090122.png",
          },
          dark: {
            "1x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_1X_090122.png",
            "2x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_2X_090122.png",
            "3x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_3X_090122.png",
          },
        },
      },
      fetchedAt: "2026-11-02T06:20:00.000Z",
    },
  });

export type WeatherReportResponse = z.infer<typeof weatherReportSchema>;
