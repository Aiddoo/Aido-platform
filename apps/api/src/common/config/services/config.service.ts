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
		return {
			clientId: this.get("APPLE_CLIENT_ID"),
			serviceId: this.get("APPLE_SERVICE_ID"),
			teamId: this.get("APPLE_TEAM_ID"),
			keyId: this.get("APPLE_KEY_ID"),
			privateKey: this.get("APPLE_PRIVATE_KEY"),
			callbackUrl: this.get("APPLE_CALLBACK_URL"),
			isConfigured: !!(
				this.get("APPLE_CLIENT_ID") &&
				this.get("APPLE_TEAM_ID") &&
				this.get("APPLE_KEY_ID") &&
				this.get("APPLE_PRIVATE_KEY")
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
		};
	}

	// ============================================
	// External Services Helpers
	// ============================================

	get expoAccessToken(): string | undefined {
		return this.get("EXPO_ACCESS_TOKEN");
	}

	get revenueCatApiKey(): string | undefined {
		return this.get("REVENUECAT_API_KEY");
	}

	get redisUrl(): string | undefined {
		return this.get("REDIS_URL");
	}

	get sentryDsn(): string | undefined {
		return this.get("SENTRY_DSN");
	}
}
