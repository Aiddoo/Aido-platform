import { z } from "zod";

import { type AppEnvironment, type NodeEnvironment, resolveAppEnvironment } from "./app.schema.js";

/**
 * 외부 서비스 연동 설정 스키마
 * 향후 확장용 - 현재는 선택적
 */
export const externalSchema = z.object({
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  /** 운영 알림의 RevenueCat 고객 화면 링크용 공개 프로젝트 ID(비밀 아님) */
  REVENUECAT_PROJECT_ID: z.string().min(1).optional(),
  /**
   * RevenueCat REST API v2 비밀 키(읽기 전용: customer_information:subscriptions:read,
   * project_configuration:products:read). REVENUECAT_PROJECT_ID와 함께 있어야 웹훅 뒤 스토어 상태 대조가 켜진다.
   */
  REVENUECAT_API_V2_SECRET_KEY: z.string().min(1).optional(),

  // Redis 캐시/세션 (선택) - 빈 문자열 허용
  REDIS_URL: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("redis"), {
      error: "REDIS_URL must be a valid Redis URL (redis:// or rediss://)",
    }),

  // Sentry 에러 모니터링 (선택) - 빈 문자열 허용
  SENTRY_DSN: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("https://"), {
      error: "SENTRY_DSN must be a valid HTTPS URL",
    }),

  // Sentry 트레이스 샘플링 비율 (0.0 ~ 1.0, 기본값: production=0.2, 나머지=1.0)
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),

  // 공공데이터포털 서비스키 (기상청 단기예보, 생활기상지수, 천문연구원 출몰시각, 에어코리아 공용)
  KMA_API_KEY: z.string().optional(),

  // Apple WeatherKit REST (날씨 v2). 네 값을 모두 넣거나 모두 비운다.
  WEATHERKIT_TEAM_ID: z.string().optional(),
  WEATHERKIT_KEY_ID: z.string().optional(),
  // 앱 번들 ID가 아니라 Identifiers → Services IDs에 등록한 ID (예: com.example.weatherkit)
  WEATHERKIT_SERVICE_ID: z.string().optional(),
  // .env는 한 줄 값이라 PEM 줄바꿈을 `\n`으로 적는다. 검증할 때 실제 줄바꿈으로 복원한다.
  WEATHERKIT_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((value) => value?.replaceAll("\\n", "\n")),
});

export type ExternalConfig = z.infer<typeof externalSchema>;

const WEATHERKIT_KEYS = [
  "WEATHERKIT_TEAM_ID",
  "WEATHERKIT_KEY_ID",
  "WEATHERKIT_SERVICE_ID",
  "WEATHERKIT_PRIVATE_KEY",
] as const;

/**
 * WeatherKit 자격은 일부만 있으면 서명이 항상 실패하므로 모두 있거나 모두 없어야 한다.
 * 운영에서는 날씨 v2가 항상 WEATHER_1901이 되지 않도록 네 값을 모두 요구한다.
 */
export function validateWeatherKitConfig({
  value: config,
  issues,
}: z.core.ParsePayload<
  ExternalConfig & { readonly NODE_ENV: NodeEnvironment; readonly APP_ENV?: AppEnvironment }
>): void {
  const missing = WEATHERKIT_KEYS.filter((key) => (config[key] ?? "") === "");
  const isProduction = resolveAppEnvironment(config) === "production";
  if (missing.length === 0 || (missing.length === WEATHERKIT_KEYS.length && !isProduction)) {
    return;
  }
  for (const key of missing) {
    issues.push({
      code: "custom",
      input: config,
      path: [key],
      message: isProduction
        ? `${key} is required in production`
        : `${key} is required when any WEATHERKIT_* value is set`,
    });
  }
}
