/**
 * 민감 정보를 마스킹할 경로들
 */
export const LOGGER_REDACT_PATHS = [
	"req.headers.authorization",
	"req.headers.cookie",
	"req.body.password",
	"req.body.currentPassword",
	"req.body.newPassword",
	"req.body.confirmPassword",
	"req.body.token",
	"req.body.refreshToken",
	"req.body.accessToken",
] as const;

/**
 * 로깅에서 제외할 라우트들
 */
export const LOGGER_EXCLUDED_ROUTES = ["/health", "/api/docs"] as const;

/**
 * 기본 로그 레벨
 */
export const LOGGER_DEFAULT_LEVEL = {
	development: "debug",
	production: "info",
	test: "warn",
} as const;

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
