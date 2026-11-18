import { jwtConfig } from "../jwt.config.js";
import { envSchema } from "./env.schema.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/aido",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("JWT 수명 환경 설정", () => {
  it.each([
    { access: "15m", refresh: "30d" },
    { access: "900s", refresh: "07d" },
    { access: "1d", refresh: "365d" },
    { access: "24h", refresh: "8760h" },
    { access: "01h", refresh: "2d" },
  ])(
    "예전 정수+단위 값 access $access·refresh $refresh는 범위 안이라 받는다",
    ({ access, refresh }) => {
      // Given
      const environment = {
        ...requiredEnvironment,
        JWT_EXPIRES_IN: access,
        JWT_REFRESH_EXPIRES_IN: refresh,
      };

      // When
      const result = envSchema.safeParse(environment);

      // Then
      expect(result.success).toBe(true);
    },
  );

  it.each([
    { name: "JWT_EXPIRES_IN", value: "0s" },
    { name: "JWT_EXPIRES_IN", value: "-15m" },
    { name: "JWT_EXPIRES_IN", value: "25h" },
    { name: "JWT_EXPIRES_IN", value: "2d" },
    { name: "JWT_REFRESH_EXPIRES_IN", value: "0d" },
    { name: "JWT_REFRESH_EXPIRES_IN", value: "-1d" },
    { name: "JWT_REFRESH_EXPIRES_IN", value: "366d" },
    { name: "JWT_REFRESH_EXPIRES_IN", value: "100000000d" },
    { name: "JWT_REFRESH_EXPIRES_IN", value: "1.5d" },
  ])("$name=$value는 시작을 거부한다", ({ name, value }) => {
    // Given
    const environment = { ...requiredEnvironment, [name]: value };

    // When
    const result = envSchema.safeParse(environment);

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(name);
  });

  it.each([
    { access: "1d", refresh: "1d" },
    { access: "1d", refresh: "12h" },
  ])("access $access가 refresh $refresh보다 짧지 않으면 시작을 거부한다", ({ access, refresh }) => {
    // Given
    const environment = {
      ...requiredEnvironment,
      JWT_EXPIRES_IN: access,
      JWT_REFRESH_EXPIRES_IN: refresh,
    };

    // When
    const fromEnvironment = envSchema.safeParse(environment);
    const fromNamespace = () => jwtConfig.parse(environment);

    // Then
    expect(fromEnvironment.success).toBe(false);
    expect(fromEnvironment.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "JWT_EXPIRES_IN",
    ]);
    expect(fromNamespace).toThrow("JWT_EXPIRES_IN must be shorter than JWT_REFRESH_EXPIRES_IN");
  });
});
