import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import type { EnvConfig } from "../schemas";

/**
 * 타입 안전한 ConfigService 래퍼
 *
 * 기존 NestJS ConfigService를 확장하여
 * 환경변수에 대한 자동완성과 타입 안전성을 제공합니다.
 */
@Injectable()
export class TypedConfigService {
	constructor(private configService: NestConfigService<EnvConfig, true>) {}

	/**
	 * 환경변수 값을 타입 안전하게 가져옵니다.
	 */
	get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
		return this.configService.get(key, { infer: true });
	}

	/**
	 * 현재 환경이 development인지 확인
	 */
	get isDevelopment(): boolean {
		return this.get("NODE_ENV") === "development";
	}

	/**
	 * 현재 환경이 production인지 확인
	 */
	get isProduction(): boolean {
		return this.get("NODE_ENV") === "production";
	}

	/**
	 * 현재 환경이 test인지 확인
	 */
	get isTest(): boolean {
		return this.get("NODE_ENV") === "test";
	}

	// ============================================
	// App Config Helpers
	// ============================================

	get port(): number {
		return this.get("PORT");
	}

	get nodeEnv(): string {
		return this.get("NODE_ENV");
	}

	/**
	 * 배포 환경 (development | staging | production)
	 *
	 * NODE_ENV와 분리된 개념 — 개발서버도 production 빌드로 돌므로
	 * "실제 프로덕션" 구분은 APP_ENV가 단일 진실이다.
	 * 미설정 시 NODE_ENV 기준 폴백 (기존 배포 하위호환).
	 */
	get appEnv(): "development" | "staging" | "production" {
		const appEnv = this.get("APP_ENV");
		if (appEnv) {
			return appEnv;
		}

		return this.isProduction ? "production" : "development";
	}

	// ============================================
	// Database Config Helpers
	// ============================================

	get databaseUrl(): string {
		return this.get("DATABASE_URL");
	}

	// ============================================
	// JWT Config Helpers
	// ============================================

	get jwtSecret(): string {
		return this.get("JWT_SECRET");
	}

	get jwtRefreshSecret(): string {
		return this.get("JWT_REFRESH_SECRET");
	}

	get jwtExpiresIn(): string {
		return this.get("JWT_EXPIRES_IN");
	}

	get jwtRefreshExpiresIn(): string {
		return this.get("JWT_REFRESH_EXPIRES_IN");
	}

	// ============================================
	// Security Config Helpers
	// ============================================

	get corsOrigins(): string[] {
		return this.get("CORS_ORIGINS");
	}

	get throttleTtl(): number {
		return this.get("THROTTLE_TTL");
	}

	get throttleLimit(): number {
		return this.get("THROTTLE_LIMIT");
	}

	get tokenEncryptionKey(): string {
		return this.get("TOKEN_ENCRYPTION_KEY");
	}

	// ============================================
	// OAuth Config Helpers
	// ============================================

	get googleOAuth() {
		return {
			clientId: this.get("GOOGLE_CLIENT_ID"),
			clientSecret: this.get("GOOGLE_CLIENT_SECRET"),
			callbackUrl: this.get("GOOGLE_CALLBACK_URL"),
			isConfigured: !!(
				this.get("GOOGLE_CLIENT_ID") && this.get("GOOGLE_CLIENT_SECRET")
			),
		};
	}

	get appleOAuth() {
		const rawPrivateKey = this.get("APPLE_PRIVATE_KEY");
		// 환경변수에는 PEM 헤더/푸터 없이 키 내용만 저장되어 있으므로 PEM 형식으로 변환
		const privateKey = rawPrivateKey
			? `-----BEGIN PRIVATE KEY-----\n${rawPrivateKey}\n-----END PRIVATE KEY-----`
			: undefined;

		return {
			clientId: this.get("APPLE_CLIENT_ID"),
			serviceId: this.get("APPLE_SERVICE_ID"),
			teamId: this.get("APPLE_TEAM_ID"),
			keyId: this.get("APPLE_KEY_ID"),
			privateKey,
			callbackUrl: this.get("APPLE_CALLBACK_URL"),
			isConfigured: !!(
				this.get("APPLE_CLIENT_ID") &&
				this.get("APPLE_TEAM_ID") &&
				this.get("APPLE_KEY_ID") &&
				rawPrivateKey
			),
		};
	}

	get kakaoOAuth() {
		return {
			clientId: this.get("KAKAO_CLIENT_ID"),
			clientSecret: this.get("KAKAO_CLIENT_SECRET"),
			callbackUrl: this.get("KAKAO_CALLBACK_URL"),
			isConfigured: !!(
				this.get("KAKAO_CLIENT_ID") && this.get("KAKAO_CLIENT_SECRET")
			),
		};
	}

	get naverOAuth() {
		return {
			clientId: this.get("NAVER_CLIENT_ID"),
			clientSecret: this.get("NAVER_CLIENT_SECRET"),
			callbackUrl: this.get("NAVER_CALLBACK_URL"),
			isConfigured: !!(
				this.get("NAVER_CLIENT_ID") && this.get("NAVER_CLIENT_SECRET")
			),
		};
	}

	// ============================================
	// Email Config Helpers
	// ============================================

	get email() {
		return {
			apiKey: this.get("RESEND_API_KEY"),
			from: this.get("EMAIL_FROM"),
			fromName: this.get("EMAIL_FROM_NAME"),
			isConfigured: !!this.get("RESEND_API_KEY"),
			supportEmail: this.get("SUPPORT_EMAIL"),
		};
	}

	// ============================================
	// External Services Helpers
	// ============================================

	get expoAccessToken(): string | undefined {
		return this.get("EXPO_ACCESS_TOKEN");
	}

	get revenuecat() {
		return {
			secretApiKey: this.get("REVENUECAT_SECRET_API_KEY"),
			webhookSecret: this.get("REVENUECAT_WEBHOOK_SECRET"),
		};
	}

	get redisUrl(): string | undefined {
		return this.get("REDIS_URL");
	}

	get sentryDsn(): string | undefined {
		return this.get("SENTRY_DSN");
	}

	get sentryTracesSampleRate(): number | undefined {
		return this.get("SENTRY_TRACES_SAMPLE_RATE");
	}

	// TODO: 서비스 스케일업 시 릴리스 버저닝 추가 (sentryRelease getter)

	// ============================================
	// AI Config Helpers
	// ============================================

	get aiDailyLimit(): number {
		return this.get("AI_DAILY_LIMIT");
	}

	get googleGenerativeAiApiKey(): string | undefined {
		return this.get("GOOGLE_GENERATIVE_AI_API_KEY");
	}

	get dataGoKrApiKey(): string | undefined {
		return this.get("KMA_API_KEY");
	}

	// ============================================
	// Cache Config Helpers
	// ============================================

	get cache() {
		return {
			type: this.get("CACHE_TYPE") as "memory" | "redis",
			defaultTtlMs: this.get("CACHE_DEFAULT_TTL_MS"),
			maxItems: this.get("CACHE_MAX_ITEMS"),
			cleanupIntervalMs: this.get("CACHE_CLEANUP_INTERVAL_MS"),
		};
	}

	get redis() {
		return {
			host: this.get("REDIS_HOST"),
			port: this.get("REDIS_PORT"),
			password: this.get("REDIS_PASSWORD"),
			db: this.get("REDIS_DB"),
			commandTimeoutMs: this.get("REDIS_COMMAND_TIMEOUT_MS"),
			connectTimeoutMs: this.get("REDIS_CONNECT_TIMEOUT_MS"),
		};
	}

	// ============================================
	// Logger Config Helpers
	// ============================================

	get logLevel(): string | undefined {
		return this.get("LOG_LEVEL");
	}

	// ============================================
	// Webhook Config Helpers
	// ============================================

	get discordSignupWebhookUrl(): string | undefined {
		return this.get("DISCORD_SIGNUP_WEBHOOK_URL");
	}

	get discordPaymentWebhookUrl(): string | undefined {
		return this.get("DISCORD_PAYMENT_WEBHOOK_URL");
	}
}
