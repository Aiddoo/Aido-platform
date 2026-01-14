import { z } from "zod";

/**
 * 외부 서비스 연동 설정 스키마
 * 향후 확장용 - 현재는 선택적
 */
export const externalSchema = z.object({
	// RevenueCat 구독 관리
	REVENUECAT_API_KEY: z.string().optional(),

	// Redis 캐시/세션 (선택)
	REDIS_URL: z.string().url().optional(),

	// Sentry 에러 모니터링 (선택)
	SENTRY_DSN: z.string().url().optional(),
});

export type ExternalConfig = z.infer<typeof externalSchema>;
