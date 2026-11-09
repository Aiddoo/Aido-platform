import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

import { AI_CONFIG_KEYS, aiSchema, type AiSettings, toAiSettings } from "../schemas/ai.schema.js";
import type { EnvConfig } from "../schemas/index.js";

/**
 * 타입 안전한 ConfigService 래퍼
 *
 * 기존 NestJS ConfigService를 확장하여
 * 환경변수에 대한 자동완성과 타입 안전성을 제공합니다.
 */
@Injectable()
export class TypedConfigService {
  #ai: AiSettings | undefined;

  constructor(private configService: NestConfigService<EnvConfig, true>) {}

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.configService.get(key, { infer: true });
  }

  get isDevelopment(): boolean {
    return this.get("NODE_ENV") === "development";
  }

  get isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }

  get isTest(): boolean {
    return this.get("NODE_ENV") === "test";
  }

  get port(): number {
    return this.get("PORT");
  }

  get nodeEnv(): EnvConfig["NODE_ENV"] {
    return this.get("NODE_ENV");
  }

  /** 헬스 체크 응답에 노출할 인스턴스 식별자 */
  get instanceId(): string | undefined {
    return this.get("INSTANCE_ID");
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

  get databaseUrl(): string {
    return this.get("DATABASE_URL");
  }

  get database() {
    return {
      url: this.get("DATABASE_URL"),
      poolMax: this.get("DATABASE_POOL_MAX"),
      idleTimeoutMs: this.get("DATABASE_POOL_IDLE_TIMEOUT_MS"),
      connectionTimeoutMs: this.get("DATABASE_POOL_CONNECTION_TIMEOUT_MS"),
    };
  }

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

  get tokenEncryptionSalt(): string | undefined {
    return this.get("TOKEN_ENCRYPTION_SALT");
  }

  get googleOAuth() {
    return {
      clientId: this.get("GOOGLE_CLIENT_ID"),
      clientSecret: this.get("GOOGLE_CLIENT_SECRET"),
      callbackUrl: this.get("GOOGLE_CALLBACK_URL"),
      isConfigured: !!(this.get("GOOGLE_CLIENT_ID") && this.get("GOOGLE_CLIENT_SECRET")),
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
      jwksUrl: this.get("APPLE_JWKS_URL"),
      jwksCooldownDurationMs: this.get("APPLE_JWKS_COOLDOWN_DURATION_MS"),
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
      isConfigured: !!(this.get("KAKAO_CLIENT_ID") && this.get("KAKAO_CLIENT_SECRET")),
    };
  }

  get naverOAuth() {
    return {
      clientId: this.get("NAVER_CLIENT_ID"),
      clientSecret: this.get("NAVER_CLIENT_SECRET"),
      callbackUrl: this.get("NAVER_CALLBACK_URL"),
      isConfigured: !!(this.get("NAVER_CLIENT_ID") && this.get("NAVER_CLIENT_SECRET")),
    };
  }

  /** 외부에서 이 API에 닿는 기준 주소. 끝의 / 는 뗀다 */
  get apiPublicUrl(): string | undefined {
    return this.get("API_PUBLIC_URL")?.replace(/\/+$/, "");
  }

  get email() {
    return {
      provider: this.get("EMAIL_PROVIDER"),
      apiKey: this.get("RESEND_API_KEY"),
      from: this.get("EMAIL_FROM"),
      fromName: this.get("EMAIL_FROM_NAME"),
      supportEmail: this.get("SUPPORT_EMAIL"),
    };
  }

  get expoAccessToken(): string | undefined {
    return this.get("EXPO_ACCESS_TOKEN");
  }

  get pushRateLimitBackend(): "postgres" | "redis" | "memory" {
    return this.get("PUSH_RATE_LIMIT_BACKEND");
  }

  get retentionOnboardingV2() {
    return {
      enabled: this.get("RETENTION_ONBOARDING_V2_ENABLED"),
      treatmentPercent: this.get("RETENTION_ONBOARDING_V2_TREATMENT_PERCENT"),
    };
  }

  get featureDiscovery() {
    return {
      enabled: this.get("FEATURE_DISCOVERY_ENABLED"),
      campaignId: this.get("FEATURE_DISCOVERY_CAMPAIGN_ID"),
      minAppVersion: this.get("FEATURE_DISCOVERY_MIN_APP_VERSION"),
      launchedAt: this.get("FEATURE_DISCOVERY_LAUNCHED_AT"),
      autoOpen: this.get("FEATURE_DISCOVERY_AUTO_OPEN"),
    };
  }

  get appVersion() {
    return {
      enabled: this.get("APP_VERSION_CHECK_ENABLED"),
      iosLatestVersion: this.get("APP_VERSION_CHECK_IOS_LATEST_VERSION"),
      androidLatestVersion: this.get("APP_VERSION_CHECK_ANDROID_LATEST_VERSION"),
    };
  }

  get revenuecat() {
    return {
      secretApiKey: this.get("REVENUECAT_SECRET_API_KEY"),
      webhookSecret: this.get("REVENUECAT_WEBHOOK_SECRET"),
      projectId: this.get("REVENUECAT_PROJECT_ID"),
      apiV2SecretKey: this.get("REVENUECAT_API_V2_SECRET_KEY"),
    };
  }

  get nudge() {
    return { interactionsEnabled: this.get("NUDGE_INTERACTIONS_ENABLED") };
  }

  get invite() {
    return {
      enabled: this.get("INVITE_ENABLED"),
      claimHashSecret: this.get("INVITE_CLAIM_HASH_SECRET"),
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

  /** AI 업체 키·순서·모델과 작업별 설정. 처음 읽을 때 한 번 파싱해 고정한다. */
  get ai(): AiSettings {
    this.#ai ??= Object.freeze(
      toAiSettings(
        aiSchema.parse(Object.fromEntries(AI_CONFIG_KEYS.map((key) => [key, this.get(key)]))),
      ),
    );
    return this.#ai;
  }

  get dataGoKrApiKey(): string | undefined {
    return this.get("KMA_API_KEY");
  }

  /** 네 값이 모두 있을 때만 자격을 돌려준다. 스키마가 all-or-none을 보장한다. */
  get weatherKit(): {
    readonly teamId: string;
    readonly keyId: string;
    readonly serviceId: string;
    readonly privateKey: string;
  } | null {
    const teamId = this.get("WEATHERKIT_TEAM_ID");
    const keyId = this.get("WEATHERKIT_KEY_ID");
    const serviceId = this.get("WEATHERKIT_SERVICE_ID");
    const privateKey = this.get("WEATHERKIT_PRIVATE_KEY");
    if (!teamId || !keyId || !serviceId || !privateKey) {
      return null;
    }
    return { teamId, keyId, serviceId, privateKey };
  }

  get cache() {
    return {
      type: this.get("CACHE_TYPE"),
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

  get job() {
    return {
      schema: this.get("JOB_SCHEMA"),
      shutdownTimeoutMs: this.get("JOB_SHUTDOWN_TIMEOUT_MS"),
      pollingIntervalSeconds: this.get("JOB_POLLING_INTERVAL_SECONDS"),
    };
  }

  get logLevel(): string | undefined {
    return this.get("LOG_LEVEL");
  }

  get adminNotifierProvider() {
    return this.get("ADMIN_NOTIFIER_PROVIDER");
  }

  get discordSignupWebhookUrl(): string | undefined {
    return this.get("DISCORD_SIGNUP_WEBHOOK_URL");
  }

  get discordPaymentWebhookUrl(): string | undefined {
    return this.get("DISCORD_PAYMENT_WEBHOOK_URL");
  }
}
