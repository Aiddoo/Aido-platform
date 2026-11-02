import { externalSchema } from "./external.schema.js";
import { envSchema } from "./index.js";

const LEGACY_KEY = `AIza${"a".repeat(35)}`;
const NEW_FORMAT_KEY = `AQ.${"Ab1_-".repeat(10)}`;

describe("externalSchema — GOOGLE_GENERATIVE_AI_API_KEY", () => {
  it("기존 AIza 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: LEGACY_KEY };

    // When
    const config = externalSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(LEGACY_KEY);
  });

  it("새 AQ. 형식 키를 받는다", () => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: NEW_FORMAT_KEY };

    // When
    const config = externalSchema.parse(env);

    // Then
    expect(NEW_FORMAT_KEY).toHaveLength(53);
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(NEW_FORMAT_KEY);
  });

  it.each([
    ["앞뒤 공백", ` ${NEW_FORMAT_KEY} `],
    ["중간 공백", `${LEGACY_KEY.slice(0, 20)} ${LEGACY_KEY.slice(20)}`],
    ["줄바꿈", `${NEW_FORMAT_KEY}\n`],
  ])("%s이 섞인 키를 거부한다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const result = externalSchema.safeParse(env);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([
    ["허용하지 않는 문자", `AQ.${"a".repeat(40)}/+=`],
    ["30자 미만", "AQ.short-key"],
  ])("%s가 있는 키를 거부한다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const result = externalSchema.safeParse(env);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([
    ["미설정", undefined],
    ["빈 문자열", ""],
  ])("%s 키는 기존처럼 AI 미설정으로 통과시킨다", (_case, key) => {
    // Given
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: key };

    // When
    const config = externalSchema.parse(env);

    // Then
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe(key);
  });
});

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
  it("DATABASE_POOL_MAX 기본값은 10이고 시간 제한은 비우면 pg 기본값을 쓴다", () => {
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
    expect(config.DATABASE_POOL_CONNECTION_TIMEOUT_MS).toBeUndefined();
  });
});
