import { validateEnv } from "./env.schema.js";
import { productionConfigWarnings } from "./production-readiness.js";

const SECRET_VALUES = {
  JWT_SECRET: "jwt-secret-value-0123456789abcdef0123",
  JWT_REFRESH_SECRET: "refresh-secret-value-0123456789abcdef",
  TOKEN_ENCRYPTION_KEY: "token-encryption-key-0123456789abcdef",
  RESEND_API_KEY: "re_resend_secret_value",
  REVENUECAT_WEBHOOK_SECRET: "revenuecat-webhook-secret-value",
  GOOGLE_CLIENT_SECRET: "google-client-secret-value",
};

const PRODUCTION = {
  NODE_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://postgres:password@db.example.com:5432/aido",
  GOOGLE_CLIENT_ID: "google-client-id",
  WEATHERKIT_TEAM_ID: "TEAMID1234",
  WEATHERKIT_KEY_ID: "KEYID12345",
  WEATHERKIT_SERVICE_ID: "com.example.weatherkit-client",
  WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nplaceholder\\n-----END PRIVATE KEY-----",
  ...SECRET_VALUES,
};

function startupError(env: Readonly<Record<string, string | undefined>>): string {
  try {
    validateEnv(env);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("운영 시작 검증 — 위험한 조합 거부", () => {
  it("공급자를 비워 둔 운영은 resend·discord로 시작한다", () => {
    // When
    const error = startupError(PRODUCTION);

    // Then
    expect(error).toBe("");
  });

  it.each([
    {
      name: "보내지 않는 이메일 어댑터",
      change: { EMAIL_PROVIDER: "log" },
      key: "EMAIL_PROVIDER",
    },
    { name: "Resend 키 없음", change: { RESEND_API_KEY: undefined }, key: "RESEND_API_KEY" },
    {
      name: "알리지 않는 관리자 알림 어댑터",
      change: { ADMIN_NOTIFIER_PROVIDER: "log" },
      key: "ADMIN_NOTIFIER_PROVIDER",
    },
    {
      name: "웹훅 서명 비밀 없음",
      change: { REVENUECAT_WEBHOOK_SECRET: undefined },
      key: "REVENUECAT_WEBHOOK_SECRET",
    },
    {
      name: "빈 웹훅 서명 비밀",
      change: { REVENUECAT_WEBHOOK_SECRET: "" },
      key: "REVENUECAT_WEBHOOK_SECRET",
    },
    {
      name: "로그인 공급자 없음",
      change: { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined },
      key: "OAUTH",
    },
    {
      name: "WeatherKit 자격 없음",
      change: { WEATHERKIT_PRIVATE_KEY: undefined },
      key: "WEATHERKIT_PRIVATE_KEY",
    },
  ])("$name이면 키 이름으로 시작을 거부하고 값은 싣지 않는다", ({ change, key }) => {
    // Given
    const env = { ...PRODUCTION, ...change };

    // When
    const error = startupError(env);

    // Then
    expect(error).toContain(`- ${key}:`);
    for (const secret of Object.values(SECRET_VALUES)) {
      expect(error).not.toContain(secret);
    }
  });

  it("APP_ENV가 없던 옛 운영 배포(NODE_ENV=production)도 같은 규칙을 지킨다", () => {
    // Given
    const env = { ...PRODUCTION, APP_ENV: undefined, EMAIL_PROVIDER: "log" };

    // When
    const error = startupError(env);

    // Then
    expect(error).toContain("- EMAIL_PROVIDER:");
  });

  it.each([
    { name: "스테이징", appEnv: "staging" },
    { name: "배포된 개발서버", appEnv: "development" },
  ])("$name은 운영 전용 규칙을 적용하지 않는다", ({ appEnv }) => {
    // Given
    const env = {
      ...PRODUCTION,
      APP_ENV: appEnv,
      EMAIL_PROVIDER: "log",
      ADMIN_NOTIFIER_PROVIDER: "log",
      REVENUECAT_WEBHOOK_SECRET: undefined,
    };

    // When
    const error = startupError(env);

    // Then
    expect(error).toBe("");
  });
});

describe("운영 시작 경고", () => {
  it.each([
    { environment: "production", sentryDsn: undefined, warnings: ["SENTRY_DSN"] },
    { environment: "production", sentryDsn: "https://key@sentry.example/1", warnings: [] },
    { environment: "staging", sentryDsn: undefined, warnings: [] },
  ] as const)(
    "$environment·DSN $sentryDsn이면 경고 $warnings를 남기고 시작은 막지 않는다",
    ({ environment, sentryDsn, warnings }) => {
      // When
      const result = productionConfigWarnings({ environment, sentryDsn });

      // Then
      expect(result).toEqual(warnings);
    },
  );

  it("Sentry DSN이 없어도 운영 시작 검증은 통과한다", () => {
    // Given
    const env = { ...PRODUCTION, SENTRY_DSN: undefined };

    // When
    const error = startupError(env);

    // Then
    expect(error).toBe("");
  });
});
