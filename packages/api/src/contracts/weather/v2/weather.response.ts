import { z } from "zod";

import { dateSchema, datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import {
  WEATHER_AIR_QUALITY_SOURCES,
  WEATHER_ALERT_SEVERITIES,
  WEATHER_CONDITIONS,
  WEATHER_DAY_PARTS,
  WEATHER_MOON_PHASES,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  WEATHER_PRESSURE_TRENDS,
  WEATHER_PROVIDERS,
  WEATHER_REPORT_LIMITS,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  WEATHER_RESCHEDULE_REASONS,
  WEATHER_WET_HAZARDS,
} from "../../../vocabulary/weather.constants.js";

const percentSchema = z.int().min(0).max(100);

// 앞으로 더할 열거 값은 출시된 앱이 리포트를 버리지 않게 그 칸만 대체값으로 읽는다(compatibility.md). 서버 응답 값은 같다
/** 흐림: 아이콘·장면이 있고 비·눈·더위·서리 효과나 경고를 만들지 않는다 */
const weatherConditionSchema = z.enum(WEATHER_CONDITIONS).catch("CLOUDY");
/** 섞임: 강수 확률이 높은 시간에만 "비나 눈"으로 말하고 마른 시간에는 보이지 않는다 */
const weatherPrecipitationTypeSchema = z.enum(WEATHER_PRECIPITATION_TYPES).catch("MIXED");
const timezoneSchema = z
  .string()
  .min(1)
  .max(50)
  .meta({ description: "IANA 시간대 (예: Asia/Seoul)" });

export const weatherLocationSchema = z.object({
  latitude: z.number().meta({ description: "위도 (WGS84)" }),
  longitude: z.number().meta({ description: "경도 (WGS84)" }),
  timezone: timezoneSchema,
});

export type WeatherLocationResponse = z.infer<typeof weatherLocationSchema>;

export const weatherCurrentConditionsSchema = z.object({
  observedAt: datetimeSchema.meta({ description: "관측 시각" }),
  condition: weatherConditionSchema.meta({ description: "날씨 상태" }),
  isDaylight: z.boolean().meta({ description: "관측 시각이 낮인지 여부" }),
  temperature: z.number().meta({ description: "기온 (°C)" }),
  apparentTemperature: z.number().meta({ description: "체감 온도 (°C)" }),
  dewPoint: z.number().meta({ description: "이슬점 (°C)" }),
  humidity: percentSchema.meta({ description: "상대 습도 (%)" }),
  cloudCover: percentSchema.meta({ description: "운량 (%)" }),
  uvIndex: z.int().min(0).meta({ description: "자외선 지수" }),
  windSpeed: z.number().min(0).meta({ description: "풍속 (m/s)" }),
  windGust: z.number().min(0).nullable().meta({ description: "돌풍 (m/s)" }),
  windDirection: z.int().min(0).max(359).nullable().meta({ description: "풍향 (도, 북=0)" }),
  visibility: z.number().min(0).meta({ description: "가시거리 (m)" }),
  pressure: z.number().min(0).meta({ description: "해면기압 (hPa)" }),
  pressureTrend: z.enum(WEATHER_PRESSURE_TRENDS).catch("STEADY").meta({ description: "기압 추세" }),
  precipitationIntensity: z.number().min(0).meta({ description: "강수 강도 (mm/h)" }),
});

export const weatherMinuteForecastSchema = z.object({
  startsAt: datetimeSchema.meta({ description: "분 단위 구간 시작 시각" }),
  precipitationChance: percentSchema.meta({ description: "강수 확률 (%)" }),
  precipitationIntensity: z.number().min(0).meta({ description: "강수 강도 (mm/h)" }),
});

export const weatherNextHourPeriodSchema = z.object({
  condition: z.enum(WEATHER_NEXT_HOUR_CONDITIONS).meta({ description: "구간 상태" }),
  precipitationType: z.enum(WEATHER_PRECIPITATION_TYPES).nullable().catch(null).meta({
    description: "강수 형태. 맑음 구간은 NONE, 공급자가 형태 없이 '강수'로만 알리면 null",
  }),
  startsAt: datetimeSchema.meta({ description: "구간 시작 시각" }),
  endsAt: nullableDatetimeSchema.meta({
    description: "구간 끝 시각. 예보 범위 끝까지 이어지면 null",
  }),
  precipitationChance: percentSchema.meta({ description: "구간 최대 강수 확률 (%)" }),
  precipitationIntensity: z.number().min(0).meta({ description: "구간 최대 강수 강도 (mm/h)" }),
});

export type WeatherNextHourPeriod = z.infer<typeof weatherNextHourPeriodSchema>;

export const weatherNextHourSchema = z.object({
  periods: z
    .array(weatherNextHourPeriodSchema)
    .meta({ description: "맑음·강수가 바뀌는 구간 요약" }),
  minutes: z
    .array(weatherMinuteForecastSchema)
    .meta({ description: "지금부터 공급자 예보 끝(최대 약 90분)까지 1분 간격" }),
});

export const weatherHourlyForecastSchema = z.object({
  startsAt: datetimeSchema.meta({ description: "시간 구간 시작 시각" }),
  condition: weatherConditionSchema.meta({ description: "날씨 상태" }),
  isDaylight: z.boolean().meta({ description: "낮인지 여부" }),
  temperature: z.number().meta({ description: "기온 (°C)" }),
  apparentTemperature: z.number().meta({ description: "체감 온도 (°C)" }),
  humidity: percentSchema.meta({ description: "상대 습도 (%)" }),
  uvIndex: z.int().min(0).meta({ description: "자외선 지수" }),
  windSpeed: z.number().min(0).meta({ description: "풍속 (m/s)" }),
  windDirection: z.int().min(0).max(359).nullable().meta({ description: "풍향 (도, 북=0)" }),
  precipitationChance: percentSchema.meta({ description: "강수 확률 (%)" }),
  precipitationAmount: z.number().min(0).meta({ description: "강수량 (mm)" }),
  precipitationType: weatherPrecipitationTypeSchema.meta({ description: "강수 형태" }),
});

export type WeatherHourlyForecast = z.infer<typeof weatherHourlyForecastSchema>;

export const weatherDayPartForecastSchema = z.object({
  condition: weatherConditionSchema.meta({ description: "날씨 상태" }),
  temperatureMin: z.number().nullable().meta({ description: "최저 기온 (°C)" }),
  temperatureMax: z.number().nullable().meta({ description: "최고 기온 (°C)" }),
  precipitationChance: percentSchema.meta({ description: "강수 확률 (%)" }),
  precipitationAmount: z.number().min(0).meta({ description: "강수량 (mm)" }),
  precipitationType: weatherPrecipitationTypeSchema.meta({ description: "강수 형태" }),
});

export type WeatherDayPartForecast = z.infer<typeof weatherDayPartForecastSchema>;

export const weatherDailyForecastSchema = z.object({
  date: dateSchema.meta({ description: "위치 시간대 기준 날짜" }),
  condition: weatherConditionSchema.meta({ description: "날씨 상태" }),
  temperatureMin: z.number().meta({ description: "최저 기온 (°C)" }),
  temperatureMax: z.number().meta({ description: "최고 기온 (°C)" }),
  precipitationChance: percentSchema.meta({ description: "강수 확률 (%)" }),
  precipitationAmount: z.number().min(0).meta({ description: "강수량 (mm)" }),
  precipitationType: weatherPrecipitationTypeSchema.meta({ description: "강수 형태" }),
  snowfallAmount: z.number().min(0).meta({ description: "적설량 (mm, 물 환산 전 눈 깊이)" }),
  uvIndexMax: z.int().min(0).meta({ description: "최고 자외선 지수" }),
  windSpeedMax: z.number().min(0).nullable().meta({ description: "최대 풍속 (m/s)" }),
  windGustMax: z.number().min(0).nullable().meta({ description: "최대 돌풍 (m/s)" }),
  sunrise: nullableDatetimeSchema.meta({ description: "일출 시각 (극야면 null)" }),
  sunset: nullableDatetimeSchema.meta({ description: "일몰 시각 (백야면 null)" }),
  moonPhase: z.enum(WEATHER_MOON_PHASES).catch("NEW").meta({ description: "달 위상" }),
  moonrise: nullableDatetimeSchema.meta({ description: "월출 시각 (그날 뜨지 않으면 null)" }),
  moonset: nullableDatetimeSchema.meta({ description: "월몰 시각 (그날 지지 않으면 null)" }),
  restOfDay: weatherDayPartForecastSchema
    .nullable()
    .meta({ description: "지금부터 그날 끝까지 예보. 오늘 항목에만 있고 나머지는 null" }),
  daytime: weatherDayPartForecastSchema.nullable().meta({ description: "낮(07~19시) 예보" }),
  overnight: weatherDayPartForecastSchema
    .nullable()
    .meta({ description: "밤(19~다음 날 07시) 예보" }),
});

export const weatherAirQualitySchema = z.object({
  pm10: z.number().min(0).nullable().meta({ description: "미세먼지 (μg/m³)" }),
  pm25: z.number().min(0).nullable().meta({ description: "초미세먼지 (μg/m³)" }),
  source: z
    .enum(WEATHER_AIR_QUALITY_SOURCES)
    .meta({ description: "대기질 출처. 화면에 출처를 함께 표기한다" }),
});

export const weatherAlertSchema = z.object({
  id: z.string().meta({ description: "공급자 특보 ID" }),
  title: z.string().meta({ description: "특보 이름 (요청 언어로 번역됨)" }),
  severity: z.enum(WEATHER_ALERT_SEVERITIES).catch("UNKNOWN").meta({ description: "심각도" }),
  source: z.string().meta({ description: "발표 기관" }),
  areaName: z.string().nullable().meta({ description: "대상 지역 이름" }),
  effectiveAt: datetimeSchema.meta({ description: "발효 시각" }),
  expiresAt: datetimeSchema.meta({ description: "만료 시각" }),
  detailsUrl: z.url().meta({ description: "공급자 상세 페이지" }),
});

export type WeatherAlert = z.infer<typeof weatherAlertSchema>;

const weatherAttributionLogoSchema = z.object({
  "1x": z.url(),
  "2x": z.url(),
  "3x": z.url(),
});

export const weatherAttributionSchema = z.object({
  provider: z.enum(WEATHER_PROVIDERS).meta({ description: "데이터 공급자" }),
  serviceName: z.string().meta({ description: "공급자 서비스 표기 (예: Apple Weather)" }),
  legalPageUrl: z
    .url()
    .meta({ description: "공급자 데이터 출처 고지 페이지. 로고와 함께 링크로 노출해야 한다" }),
  logo: z
    .object({
      light: weatherAttributionLogoSchema.meta({ description: "밝은 배경용 로고 (검은 글자)" }),
      dark: weatherAttributionLogoSchema.meta({ description: "어두운 배경용 로고 (흰 글자)" }),
    })
    .nullable()
    .meta({
      description:
        "공급자 로고. 크기를 줄이거나 변형하지 않고 1x 크기 이상으로 표시한다. 받지 못하면 null",
    }),
});

export const weatherRescheduleOptionSchema = z.object({
  startsAt: datetimeSchema.meta({
    description: "옮길 시각 후보. 같은 날(요청 시간대)의 시간별 예보 시작 시각",
  }),
  precipitationChance: percentSchema.meta({ description: "그 시간의 강수 확률 (%)" }),
  apparentTemperature: z.number().meta({ description: "그 시간의 체감 온도 (°C)" }),
  isRecommended: z
    .boolean()
    .meta({ description: "서버가 가장 낫다고 고른 후보. 목록의 첫 항목이다" }),
});

export const weatherBriefingSchema = z.object({
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).nullable().catch(null).meta({
    description: "영향받는 할 일이 있을 때 무엇을 피해 옮길지. 비·눈(rain)이 더위(heat)보다 먼저다",
  }),
  affectedTodoIds: z.array(z.int().positive()).max(WEATHER_RESCHEDULE_MAX_TODO_IDS).meta({
    description:
      "오늘 남은 시간 중 시각이 정해진 미완료 할 일에서 날씨와 겹친 할 일 id. 시각이 이른 순이며 날씨 푸시와 같은 기준이다",
  }),
  rescheduleOptions: z
    .array(
      z.object({
        todoId: z.int().positive(),
        options: z.array(weatherRescheduleOptionSchema).max(4),
      }),
    )
    .meta({ description: "affectedTodoIds의 각 할 일을 옮길 시간 후보(최대 4개, 첫 항목이 추천)" }),
});

export type WeatherBriefing = z.infer<typeof weatherBriefingSchema>;

const weatherHourWindowSchema = z
  .object({
    startsAt: datetimeSchema.meta({ description: "그 날씨가 시작하는 시간별 예보 시작 시각" }),
    endsAt: datetimeSchema.meta({ description: "그 날씨가 이어지는 마지막 시간이 끝나는 시각" }),
  })
  .meta({ description: "같은 날씨가 이어지는 시간" });

export const weatherHeadlineSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("todoWet").meta({ description: "할 일 시각에 비·뇌우·눈이 겹친다" }),
      hazard: z
        .enum(WEATHER_WET_HAZARDS)
        .meta({ description: "겹친 날씨. 뇌우가 하나라도 있으면 storm" }),
      precipitationChance: percentSchema.meta({
        description: "알림이 고른 할 일 시각의 강수 확률 (%)",
      }),
      window: weatherHourWindowSchema,
    }),
    z.object({
      kind: z.literal("todoHot").meta({ description: "할 일 시각이 더운 낮 시간과 겹친다" }),
      peakApparentTemperature: z
        .number()
        .meta({ description: "그 더운 시간대의 가장 높은 체감 온도 (°C)" }),
      window: weatherHourWindowSchema,
    }),
    z.object({
      kind: z
        .literal("wetLater")
        .meta({ description: "할 일과 겹치지 않지만 오늘 안에 비·눈이 온다" }),
      startsAt: datetimeSchema.meta({
        description: "비·눈이 시작하는 시각. 지금 오고 있으면 응답 시각이다",
      }),
      isSnow: z.boolean().meta({ description: "눈·진눈깨비·우박인지" }),
    }),
    z.object({
      kind: z.literal("wetTomorrow").meta({ description: "오늘은 비가 없고 내일 비·눈이 온다" }),
      dayPart: z
        .enum(WEATHER_DAY_PARTS)
        .nullable()
        .meta({ description: "내일 비·눈이 시작하는 때(요청 시간대). 일별 확률로만 알면 null" }),
      isSnow: z.boolean().meta({ description: "눈·진눈깨비·우박인지" }),
    }),
    z.object({
      kind: z.literal("clear").meta({ description: "오늘 남은 낮이 맑고 덥지 않다" }),
      window: weatherHourWindowSchema.meta({ description: "야외 할 일 하기 가장 좋은 시간" }),
    }),
    z.object({
      kind: z
        .literal("tomorrow")
        .meta({ description: "저녁이고 오늘 남은 할 일이 없어 내일 날씨를 알린다" }),
      temperatureMin: z.number().meta({ description: "내일 최저 기온 (°C)" }),
      temperatureMax: z.number().meta({ description: "내일 최고 기온 (°C)" }),
      isChilly: z.boolean().meta({ description: "내일 최저 기온이 쌀쌀한 기준 이하인지" }),
    }),
    z.object({ kind: z.literal("calm").meta({ description: "알릴 날씨가 없다" }) }),
  ])
  .meta({
    description:
      "브리핑 카드가 알릴 것(서버 판단). 날씨 알림과 같은 판단이고 문구는 앱이 kind와 사실로 만든다",
  });

export type WeatherHeadline = z.infer<typeof weatherHeadlineSchema>;

export const weatherReportSchema = z
  .object({
    location: weatherLocationSchema,
    current: weatherCurrentConditionsSchema,
    nextHour: weatherNextHourSchema
      .nullable()
      .meta({ description: "분 단위 강수 예보. 지원하지 않는 지역은 null" }),
    hourly: z
      .array(weatherHourlyForecastSchema)
      .max(WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS)
      .meta({ description: "현재 시각이 속한 시간부터 최대 24시간" }),
    daily: z
      .array(weatherDailyForecastSchema)
      .max(WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS)
      .meta({ description: "오늘부터 최대 10일" }),
    alerts: z
      .array(weatherAlertSchema)
      .meta({ description: "발효 중인 기상 특보. 심각도 높은 순" }),
    // 모르는 출처를 다른 기관 이름으로 표기하지 않도록 대기질 칸째 없는 지역처럼 읽는다
    airQuality: weatherAirQualitySchema
      .nullable()
      .catch(null)
      .meta({ description: "대기질. 제공하지 않는 지역은 null" }),
    attribution: weatherAttributionSchema,
    fetchedAt: datetimeSchema.meta({
      description: "공급자에서 데이터를 받은 시각. 공급자 장애 때는 마지막 성공 시각",
    }),
    expiresAt: datetimeSchema.optional().meta({
      description:
        "서버가 이 리포트를 공급자에서 다시 받기 시작하는 시각(캐시 만료). 그 전에 다시 조회하면 같은 리포트다. 공급자 장애로 이전 데이터를 줄 때는 빠진다. 1.16.0 이하 앱은 읽지 않는다",
    }),
    briefing: weatherBriefingSchema.optional().meta({
      description:
        "영향받는 할 일과 옮길 시간 후보(서버가 판단). 오늘 할 일을 읽지 못하면 빠진다. 1.15.1에서 추가했다",
    }),
    // 서버가 앞으로 더할 kind는 앱이 리포트를 버리지 않게 머리글만 없는 것처럼 읽는다
    headline: weatherHeadlineSchema.nullable().catch(null).meta({
      description:
        "브리핑 카드 머리글. 오늘 할 일이나 위치의 오늘 일별 예보를 읽지 못하면 null이다",
    }),
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
      expiresAt: "2026-11-02T06:30:00.000Z",
      headline: { kind: "wetLater", startsAt: "2026-11-02T06:26:00.000Z", isSnow: false },
    },
  });

export type WeatherReportResponse = z.infer<typeof weatherReportSchema>;
