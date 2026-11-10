import { appConfig } from "./app.config.js";

describe("appConfig — 배포 환경 판정", () => {
  it.each([
    {
      name: "배포된 개발서버(production 빌드 + APP_ENV=development)",
      env: { NODE_ENV: "production", APP_ENV: "development" },
      environment: "development",
    },
    {
      name: "APP_ENV가 없는 기존 운영 배포",
      env: { NODE_ENV: "production" },
      environment: "production",
    },
    {
      name: "스테이징",
      env: { NODE_ENV: "production", APP_ENV: "staging" },
      environment: "staging",
    },
    { name: "로컬 개발", env: { NODE_ENV: "development" }, environment: "development" },
    { name: "테스트 실행", env: { NODE_ENV: "test" }, environment: "development" },
  ])("$name → $environment", ({ env, environment }) => {
    // When
    const config = appConfig.parse(env);

    // Then
    expect(config.environment).toBe(environment);
    expect(config.isProduction).toBe(environment === "production");
    expect(config.isDevelopment).toBe(environment === "development");
  });

  it("런타임 모드는 NODE_ENV 그대로 둔다", () => {
    // When
    const config = appConfig.parse({ NODE_ENV: "production", APP_ENV: "development" });

    // Then
    expect(config.nodeEnv).toBe("production");
  });

  it("정해진 값이 아닌 APP_ENV는 거절한다", () => {
    // When
    const parse = () => appConfig.parse({ NODE_ENV: "production", APP_ENV: "prod" });

    // Then
    expect(parse).toThrow();
  });
});
