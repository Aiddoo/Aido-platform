import { z } from "zod";

/** Gemini API 키 형식. 기존 `AIza…`와 새 `AQ.…` 키를 모두 받도록 접두사 없이 문자 집합과 길이만 본다. */
const GOOGLE_GENERATIVE_AI_API_KEY_PATTERN = /^[A-Za-z0-9._-]{30,}$/;

/**
 * 외부 서비스 연동 설정 스키마
 * 향후 확장용 - 현재는 선택적
 */
export const externalSchema = z.object({
  // RevenueCat 구독 관리
  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

  // Redis 캐시/세션 (선택) - 빈 문자열 허용
  REDIS_URL: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("redis"), {
      message: "REDIS_URL must be a valid Redis URL (redis:// or rediss://)",
    }),

  // Sentry 에러 모니터링 (선택) - 빈 문자열 허용
  SENTRY_DSN: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("https://"), {
      message: "SENTRY_DSN must be a valid HTTPS URL",
    }),

  // Sentry 트레이스 샘플링 비율 (0.0 ~ 1.0, 기본값: production=0.2, 나머지=1.0)
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),

  // TODO: 서비스 스케일업 시 릴리스 버저닝 추가 (SENTRY_RELEASE: z.string().optional())

  // Google Generative AI (Gemini) 서비스 (선택) - 빈 문자열은 미설정으로 본다.
  // Google이 키 형식을 바꾼 적이 있어(AIza… → AQ.…) 접두사는 검사하지 않는다.
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .refine((val) => !val || GOOGLE_GENERATIVE_AI_API_KEY_PATTERN.test(val), {
      message:
        "GOOGLE_GENERATIVE_AI_API_KEY must be at least 30 characters of [A-Za-z0-9._-] without whitespace",
    }),

  // 공공데이터포털 서비스키 (기상청 단기예보, 생활기상지수, 천문연구원 출몰시각, 에어코리아 공용)
  KMA_API_KEY: z.string().optional(),
});

export type ExternalConfig = z.infer<typeof externalSchema>;
