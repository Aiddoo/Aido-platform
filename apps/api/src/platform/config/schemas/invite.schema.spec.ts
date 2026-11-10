import { envSchema } from "./index.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
  // 운영 검증은 WeatherKit 자격을 요구한다.
  WEATHERKIT_TEAM_ID: "XXXXXXXXXX",
  WEATHERKIT_KEY_ID: "XXXXXXXXXX",
  WEATHERKIT_SERVICE_ID: "com.example.weatherkit-client",
  WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nREPLACE_ME\\n-----END PRIVATE KEY-----",
};

describe("친구 초대 환경 설정", () => {
  it("값이 없으면 꺼진 상태로 시작하고 해시 비밀을 요구하지 않는다", () => {
    // Given
    const environment = { ...requiredEnvironment, NODE_ENV: "production" };

    // When
    const result = envSchema.parse(environment);

    // Then
    expect(result.INVITE_ENABLED).toBe(false);
    expect(result.INVITE_CLAIM_HASH_SECRET).toBeUndefined();
  });

  it.each([
    { appEnv: "production", secret: undefined, expected: false },
    { appEnv: "production", secret: "s".repeat(31), expected: false },
    { appEnv: "production", secret: "s".repeat(32), expected: true },
    { appEnv: "staging", secret: undefined, expected: false },
    { appEnv: "staging", secret: "s".repeat(32), expected: true },
  ])(
    "$appEnv에서 켜면 해시 비밀 길이 $secret?.length를 검증한다",
    ({ appEnv, secret, expected }) => {
      // Given
      const environment = {
        ...requiredEnvironment,
        NODE_ENV: "production",
        APP_ENV: appEnv,
        INVITE_ENABLED: "true",
        ...(secret != null && { INVITE_CLAIM_HASH_SECRET: secret }),
      };

      // When
      const result = envSchema.safeParse(environment);

      // Then
      expect(result.success).toBe(expected);
    },
  );

  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" } },
    { name: "배포된 개발서버", env: { NODE_ENV: "production", APP_ENV: "development" } },
  ])("$name에서는 해시 비밀 없이도 켤 수 있다", ({ env }) => {
    // Given
    const environment = { ...requiredEnvironment, ...env, INVITE_ENABLED: "true" };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(true);
  });
});
