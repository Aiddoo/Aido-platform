import { z } from "zod";

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

	// Google Generative AI (Gemini) 서비스 (선택)
	GOOGLE_GENERATIVE_AI_API_KEY: z
		.string()
		.optional()
		.refine((val) => !val || val.startsWith("AIza"), {
			message: "GOOGLE_GENERATIVE_AI_API_KEY must start with 'AIza'",
		}),

	// AI 일일 사용 제한 (기본값: 5)
	AI_DAILY_LIMIT: z.coerce.number().int().positive().default(5),
});

export type ExternalConfig = z.infer<typeof externalSchema>;
