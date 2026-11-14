import { envSchema } from "./env.schema.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("캐시 저장소 환경 설정", () => {
  it("저장소를 정하지 않으면 주소 없이 memory로 시작한다", () => {
    // When
    const result = envSchema.parse(requiredEnvironment);

    // Then
    expect(result.CACHE_TYPE).toBe("memory");
  });

  it("redis를 고르고 주소를 주지 않으면 시작을 거부한다", () => {
    // When
    const result = envSchema.safeParse({ ...requiredEnvironment, CACHE_TYPE: "redis" });

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["REDIS_URL"]);
  });

  it("redis를 고르고 주소를 주면 그대로 받는다", () => {
    // When
    const result = envSchema.parse({
      ...requiredEnvironment,
      CACHE_TYPE: "redis",
      REDIS_URL: "redis://localhost:6379",
    });

    // Then
    expect(result.REDIS_URL).toBe("redis://localhost:6379");
  });
});
