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

describe("appConfig — 개발 도구 스위치", () => {
  const allOn = {
    exposeErrorDetails: true,
    swaggerUi: true,
    oauthDevRedirects: true,
    localCorsOrigins: true,
  };
  const allOff = {
    exposeErrorDetails: false,
    swaggerUi: false,
    oauthDevRedirects: false,
    localCorsOrigins: false,
  };

  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" }, devTools: allOn },
    {
      name: "배포된 개발서버",
      env: { NODE_ENV: "production", APP_ENV: "development" },
      devTools: allOff,
    },
    { name: "테스트 실행", env: { NODE_ENV: "test" }, devTools: allOff },
    { name: "스테이징", env: { NODE_ENV: "production", APP_ENV: "staging" }, devTools: allOff },
    { name: "운영", env: { NODE_ENV: "production", APP_ENV: "production" }, devTools: allOff },
    { name: "APP_ENV 없는 운영", env: { NODE_ENV: "production" }, devTools: allOff },
    {
      name: "소스로 띄운 운영 설정",
      env: { NODE_ENV: "development", APP_ENV: "production" },
      devTools: allOff,
    },
  ])("$name은 개발 도구를 정해진 대로 켜고 끈다", ({ env, devTools }) => {
    // When
    const config = appConfig.parse(env);

    // Then
    expect(config.devTools).toEqual(devTools);
  });
});

describe("appConfig — 로컬 실행과 응답 계약 검사", () => {
  it.each([
    {
      name: "로컬 개발",
      env: { NODE_ENV: "development" },
      isLocalRun: true,
      responseContractCheck: true,
    },
    {
      name: "테스트 실행",
      env: { NODE_ENV: "test" },
      isLocalRun: true,
      responseContractCheck: true,
    },
    {
      name: "배포된 개발서버",
      env: { NODE_ENV: "production", APP_ENV: "development" },
      isLocalRun: false,
      responseContractCheck: true,
    },
    {
      name: "스테이징",
      env: { NODE_ENV: "production", APP_ENV: "staging" },
      isLocalRun: false,
      responseContractCheck: true,
    },
    {
      name: "운영",
      env: { NODE_ENV: "production", APP_ENV: "production" },
      isLocalRun: false,
      responseContractCheck: false,
    },
  ])(
    "$name은 로컬 실행 $isLocalRun, 응답 계약 검사 $responseContractCheck다",
    ({ env, isLocalRun, responseContractCheck }) => {
      // When
      const config = appConfig.parse(env);

      // Then
      expect(config.isLocalRun).toBe(isLocalRun);
      expect(config.responseContractCheck).toBe(responseContractCheck);
    },
  );
});

describe("appConfig — 공개 health 상세", () => {
  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" }, expose: true },
    { name: "테스트 실행", env: { NODE_ENV: "test" }, expose: true },
    { name: "스테이징", env: { NODE_ENV: "production", APP_ENV: "staging" }, expose: true },
    { name: "운영", env: { NODE_ENV: "production", APP_ENV: "production" }, expose: false },
    { name: "APP_ENV 없는 운영", env: { NODE_ENV: "production" }, expose: false },
  ])("$name은 /health 상세 공개가 $expose다", ({ env, expose }) => {
    // When
    const config = appConfig.parse(env);

    // Then
    expect(config.exposeHealthDetails).toBe(expose);
  });
});
