import { envSchema } from "./env.schema.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

const publishedVersions = {
  APP_VERSION_CHECK_IOS_LATEST_VERSION: "1.15.1",
  APP_VERSION_CHECK_ANDROID_LATEST_VERSION: "1.15.0",
};

describe("앱 버전 확인 환경 설정", () => {
  it("앱 버전 환경 변수가 없으면 꺼진 채로 시작한다", () => {
    // When
    const result = envSchema.parse(requiredEnvironment);

    // Then
    expect(result.APP_VERSION_CHECK_ENABLED).toBe(false);
    expect(result.APP_VERSION_CHECK_IOS_LATEST_VERSION).toBeUndefined();
    expect(result.APP_VERSION_CHECK_ANDROID_LATEST_VERSION).toBeUndefined();
  });

  it("꺼져 있으면 버전 값의 형식이 틀려도 시작을 막지 않는다", () => {
    // When
    const result = envSchema.safeParse({
      ...requiredEnvironment,
      APP_VERSION_CHECK_ENABLED: "false",
      APP_VERSION_CHECK_IOS_LATEST_VERSION: "1.15",
    });

    // Then
    expect(result.success).toBe(true);
  });

  it("켜져 있고 두 플랫폼 버전이 MAJOR.MINOR.PATCH면 플랫폼별 값을 그대로 받는다", () => {
    // When
    const result = envSchema.parse({
      ...requiredEnvironment,
      APP_VERSION_CHECK_ENABLED: "true",
      ...publishedVersions,
    });

    // Then
    expect(result).toMatchObject({ APP_VERSION_CHECK_ENABLED: true, ...publishedVersions });
  });

  describe.each([
    ["APP_VERSION_CHECK_IOS_LATEST_VERSION"],
    ["APP_VERSION_CHECK_ANDROID_LATEST_VERSION"],
  ] as const)("켜져 있을 때 %s가", (key) => {
    it.each([
      ["없으면", undefined],
      ["두 자리면", "1.15"],
      ["프리릴리스면", "1.15.2-beta.1"],
      ["빌드 메타데이터가 붙으면", "1.15.2+156"],
      ["v로 시작하면", "v1.15.2"],
    ])("%s 그 플랫폼 키만 짚어 시작을 거부한다", (_reason, version) => {
      // When
      const result = envSchema.safeParse({
        ...requiredEnvironment,
        APP_VERSION_CHECK_ENABLED: "true",
        ...publishedVersions,
        [key]: version,
      });

      // Then
      expect(result.error?.issues.map((issue) => issue.path)).toEqual([[key]]);
    });
  });
});
