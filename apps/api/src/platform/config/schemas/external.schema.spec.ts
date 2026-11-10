import { envSchema } from "./index.js";

describe("envSchema — WeatherKit 자격", () => {
  const requiredEnvironment = {
    DATABASE_URL: "postgresql://localhost:5432/aido",
    JWT_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    TOKEN_ENCRYPTION_KEY: "c".repeat(32),
    NODE_ENV: "production",
  };
  const weatherKit = {
    WEATHERKIT_TEAM_ID: "XXXXXXXXXX",
    WEATHERKIT_KEY_ID: "XXXXXXXXXX",
    WEATHERKIT_SERVICE_ID: "com.example.weatherkit-client",
    WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nREPLACE_ME\\n-----END PRIVATE KEY-----",
  };

  it.each([
    ["개발에서 네 값이 모두 없으면 통과한다", "development", {}, true],
    ["개발에서 네 값이 모두 있으면 통과한다", "development", weatherKit, true],
    ["운영에서 네 값이 모두 있으면 통과한다", "production", weatherKit, true],
    ["운영에서 네 값이 없으면 기동을 막는다", "production", {}, false],
    [
      "배포된 개발서버(production 빌드 + APP_ENV=development)는 네 값이 없어도 통과한다",
      "production",
      { APP_ENV: "development" },
      true,
    ],
  ])("%s", (_case, nodeEnv, values, expected) => {
    // Given
    const environment = { ...requiredEnvironment, NODE_ENV: nodeEnv, ...values };
    // When
    const result = envSchema.safeParse(environment);
    // Then
    expect(result.success).toBe(expected);
  });

  it("한 줄 PEM의 \\n을 실제 줄바꿈으로 복원한다", () => {
    // Given
    const environment = { ...requiredEnvironment, ...weatherKit };
    // When
    const config = envSchema.parse(environment);
    // Then
    expect(config.WEATHERKIT_PRIVATE_KEY).toBe(
      "-----BEGIN PRIVATE KEY-----\nREPLACE_ME\n-----END PRIVATE KEY-----",
    );
  });

  it("일부만 있으면 빠진 키를 모두 알린다", () => {
    // Given
    const environment = {
      ...requiredEnvironment,
      WEATHERKIT_TEAM_ID: weatherKit.WEATHERKIT_TEAM_ID,
      WEATHERKIT_KEY_ID: "",
    };
    // When
    const result = envSchema.safeParse(environment);
    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "WEATHERKIT_KEY_ID",
      "WEATHERKIT_SERVICE_ID",
      "WEATHERKIT_PRIVATE_KEY",
    ]);
  });
});

describe("envSchema — DB 연결 풀", () => {
  it("DATABASE_POOL_MAX 기본값은 10, 연결 대기는 5초이고 유휴 시간은 비우면 pg 기본값을 쓴다", () => {
    // Given
    const environment = {
      DATABASE_URL: "postgresql://localhost:5432/aido",
      JWT_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      TOKEN_ENCRYPTION_KEY: "c".repeat(32),
    };
    // When
    const config = envSchema.parse(environment);
    // Then
    expect(config.DATABASE_POOL_MAX).toBe(10);
    expect(config.DATABASE_POOL_IDLE_TIMEOUT_MS).toBeUndefined();
    expect(config.DATABASE_POOL_CONNECTION_TIMEOUT_MS).toBe(5000);
  });
});

describe("envSchema — 쓰지 않게 된 변수", () => {
  it("스키마가 모르는 옛 변수(REVENUECAT_SECRET_API_KEY)가 운영 env에 남아 있어도 기동을 막지 않고 버린다", () => {
    // Given
    const environment = {
      DATABASE_URL: "postgresql://localhost:5432/aido",
      JWT_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      TOKEN_ENCRYPTION_KEY: "c".repeat(32),
      NODE_ENV: "development",
      REVENUECAT_SECRET_API_KEY: "sk_legacy_v1",
    };
    // When
    const result = envSchema.safeParse(environment);
    // Then
    expect(result.success).toBe(true);
    expect(result.success && "REVENUECAT_SECRET_API_KEY" in result.data).toBe(false);
  });
});
