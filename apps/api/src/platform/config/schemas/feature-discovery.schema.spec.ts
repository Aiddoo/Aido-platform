import { envSchema } from "./index.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("기능 발견 환경 설정", () => {
  it("기능 발견 환경 변수가 없으면 기본값으로 비활성화한다", () => {
    // Given / When
    const result = envSchema.parse(requiredEnvironment);

    // Then - an unset rollout must fail closed without companion variables
    expect(result.FEATURE_DISCOVERY_ENABLED).toBe(false);
    expect(result.FEATURE_DISCOVERY_CAMPAIGN_ID).toBeUndefined();
    expect(result.FEATURE_DISCOVERY_MIN_APP_VERSION).toBeUndefined();
    expect(result.FEATURE_DISCOVERY_LAUNCHED_AT).toBeUndefined();
    expect(result.FEATURE_DISCOVERY_AUTO_OPEN).toBe(true);
  });

  it("캠페인 설정이 없는 활성 rollout을 거부한다", () => {
    // Given / When
    const result = envSchema.safeParse({
      ...requiredEnvironment,
      FEATURE_DISCOVERY_ENABLED: "true",
    });

    // Then - enabled is never allowed to expose an incomplete campaign
    expect(result.success).toBe(false);
  });

  it("활성 캠페인의 모든 값을 검증하고 auto-open 기본값을 true로 설정한다", () => {
    // Given / When
    const result = envSchema.parse({
      ...requiredEnvironment,
      FEATURE_DISCOVERY_ENABLED: "true",
      FEATURE_DISCOVERY_CAMPAIGN_ID: "feature-discovery-2026-08",
      FEATURE_DISCOVERY_MIN_APP_VERSION: "1.8.0",
      FEATURE_DISCOVERY_LAUNCHED_AT: "2026-08-01T00:00:00.000Z",
    });

    // Then
    expect(result.FEATURE_DISCOVERY_AUTO_OPEN).toBe(true);
  });

  it("버전이나 출시 시각 형식이 잘못된 활성 캠페인을 거부한다", () => {
    // Given / When
    const result = envSchema.safeParse({
      ...requiredEnvironment,
      FEATURE_DISCOVERY_ENABLED: "true",
      FEATURE_DISCOVERY_CAMPAIGN_ID: "feature-discovery-2026-08",
      FEATURE_DISCOVERY_MIN_APP_VERSION: "1.8",
      FEATURE_DISCOVERY_LAUNCHED_AT: "August 1st",
    });

    // Then
    expect(result.success).toBe(false);
  });
});
