import { z } from "zod";

/**
 * 애플리케이션 기본 설정 스키마
 */
export const appSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	/**
	 * 배포 환경 — NODE_ENV(런타임 모드)와 분리된 개념.
	 * 개발서버도 production 빌드(NODE_ENV=production)로 돌기 때문에
	 * "실제 프로덕션" 구분은 이 값이 단일 진실이다 (Sentry 발송 게이트 등).
	 * 미설정 시 NODE_ENV 기준 폴백 (config.service.appEnv 참조).
	 */
	APP_ENV: z.enum(["development", "staging", "production"]).optional(),
	PORT: z.coerce.number().int().positive().default(8080),
	LOG_LEVEL: z.enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"]).optional(),
});

export type AppConfig = z.infer<typeof appSchema>;
