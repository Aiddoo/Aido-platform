import { envSchema } from "./index.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
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
    { secret: undefined, expected: false },
    { secret: "s".repeat(31), expected: false },
    { secret: "s".repeat(32), expected: true },
  ])("운영에서 켜면 해시 비밀 길이 $secret?.length를 검증한다", ({ secret, expected }) => {
    // Given
    const environment = {
      ...requiredEnvironment,
      NODE_ENV: "production",
      INVITE_ENABLED: "true",
      ...(secret !== undefined && { INVITE_CLAIM_HASH_SECRET: secret }),
    };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(expected);
  });

  it("개발 환경에서는 해시 비밀 없이도 켤 수 있다", () => {
    // Given
    const environment = { ...requiredEnvironment, NODE_ENV: "development", INVITE_ENABLED: "true" };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(true);
  });
});
