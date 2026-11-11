import { envSchema } from "./env.schema.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("토큰 서명 키 환경 설정", () => {
  it("새 서명 키가 없어도 시작한다", () => {
    // Given
    const environment = { ...requiredEnvironment };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(true);
    expect(result.data?.CURSOR_SIGNING_KEYS).toBeUndefined();
    expect(result.data?.OPT_OUT_TOKEN_SIGNING_KEYS).toBeUndefined();
  });

  it.each(["CURSOR_SIGNING_KEYS", "OPT_OUT_TOKEN_SIGNING_KEYS"])(
    "%s의 kid와 32자 이상 비밀값을 받는다",
    (name) => {
      // Given
      const environment = {
        ...requiredEnvironment,
        [name]: `k2:${"s".repeat(32)},k1:${"t".repeat(40)}`,
      };

      // When
      const result = envSchema.safeParse(environment);

      // Then
      expect(result.success).toBe(true);
    },
  );

  it.each([
    ["CURSOR_SIGNING_KEYS", `k1:${"s".repeat(31)}`],
    ["OPT_OUT_TOKEN_SIGNING_KEYS", `k1:${"s".repeat(31)}`],
    ["CURSOR_SIGNING_KEYS", "s".repeat(40)],
    ["OPT_OUT_TOKEN_SIGNING_KEYS", `k1:${"s".repeat(32)},k1:${"t".repeat(32)}`],
  ])("%s 값 %j는 시작 검증에서 거절한다", (name, value) => {
    // Given
    const environment = { ...requiredEnvironment, [name]: value };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(name);
  });
});
