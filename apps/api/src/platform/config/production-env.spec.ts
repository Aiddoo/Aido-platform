import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { z } from "zod";

import { createPostgresPoolConfig } from "../database/postgres-pool.js";
import { PG_BOSS_CLIENT, type PgBossClient, pgBossClientProvider } from "../jobs/pg-boss-client.js";
import type { NamespaceConfig } from "./define-config.js";
import { envSchema, validateEnv } from "./schemas/env.schema.js";

type Env = Readonly<Record<string, string | undefined>>;
type AnyNamespaceConfig = NamespaceConfig<z.ZodType<Record<string, unknown>>>;

const constructedPgBossOptions = vi.hoisted((): unknown[] => []);

// pg-boss는 start에서 DB에 붙으므로 생성 옵션만 기록하는 대역으로 바꾼다
vi.mock("pg-boss", () => ({
  PgBoss: class {
    constructor(options: unknown) {
      constructedPgBossOptions.push(options);
    }
    on() {
      return this;
    }
    async start() {
      return this;
    }
    async stop() {}
  },
}));

const SOURCE_ROOT = resolve(import.meta.dirname, "../..");
const ENV_EXAMPLE = resolve(SOURCE_ROOT, "../.env.example");
const SECRET_PLACEHOLDER = "production-secret-placeholder-0123456789abcdef";
// 예시는 개발 값이다. 운영에서 바꾸는 값(예시 주석의 "운영")을 여기 모아 운영 시작 검증을 돌린다
const PRODUCTION_VALUES: Env = {
  NODE_ENV: "production",
  APP_ENV: "production",
  API_PUBLIC_URL: "https://api.example.com",
  DATABASE_URL: `postgresql://postgres:${SECRET_PLACEHOLDER}@db.example.com:5432/aido?sslmode=require`,
  JWT_SECRET: SECRET_PLACEHOLDER,
  JWT_REFRESH_SECRET: `${SECRET_PLACEHOLDER}-refresh`,
  TOKEN_ENCRYPTION_KEY: `${SECRET_PLACEHOLDER}-token`,
  CORS_ORIGINS: "https://example.com",
  THROTTLE_LIMIT: "100",
  GOOGLE_CLIENT_ID: SECRET_PLACEHOLDER,
  GOOGLE_CLIENT_SECRET: SECRET_PLACEHOLDER,
  GOOGLE_CALLBACK_URL: "https://api.example.com/v1/auth/google/web-callback",
  KAKAO_CALLBACK_URL: "https://api.example.com/v1/auth/kakao/web-callback",
  NAVER_CALLBACK_URL: "https://api.example.com/v1/auth/naver/web-callback",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: SECRET_PLACEHOLDER,
  REVENUECAT_WEBHOOK_SECRET: SECRET_PLACEHOLDER,
  INVITE_CLAIM_HASH_SECRET: SECRET_PLACEHOLDER,
  // WeatherKit 네 값은 운영에서 모두 필요하다
  WEATHERKIT_TEAM_ID: "TEAMID1234",
  WEATHERKIT_KEY_ID: "KEYID12345",
  WEATHERKIT_SERVICE_ID: "com.example.weatherkit-client",
  WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nplaceholder\\n-----END PRIVATE KEY-----",
};
// production 빌드로 도는 개발서버가 시작에 꼭 넣는 값만 둔다(운영 비밀·공급자 키 없음)
const DEPLOYED_DEV_SERVER_ENV: Env = {
  NODE_ENV: "production",
  APP_ENV: "development",
  DATABASE_URL: "postgresql://aido:aido@localhost:5432/aido",
  JWT_SECRET: "development-jwt-secret-0123456789abcdef",
  JWT_REFRESH_SECRET: "development-jwt-refresh-secret-0123456789",
  TOKEN_ENCRYPTION_KEY: "development-token-encryption-key-0123456789",
};

function exampleText(): string {
  return readFileSync(ENV_EXAMPLE, "utf8");
}

/** env 예시의 키 구성에 운영 값을 덮은 env. 값은 모두 문자열이다. */
function productionEnv(): Env {
  return { ...parseEnv(exampleText()), ...PRODUCTION_VALUES };
}

function isNamespaceConfig(value: unknown): value is AnyNamespaceConfig {
  return typeof value === "function" && "KEY" in value && "namespace" in value && "parse" in value;
}

// 손으로 고른 목록이 아니라 src의 모든 *.config.ts에서 defineConfig 결과를 모아 새 설정도 저절로 검사한다
const CONFIG_FILES = globSync("**/*.config.ts", { cwd: SOURCE_ROOT });

async function loadNamespaceConfigs(): Promise<AnyNamespaceConfig[]> {
  const modules = await Promise.all(
    CONFIG_FILES.map(
      (file): Promise<Record<string, unknown>> => import(resolve(SOURCE_ROOT, file)),
    ),
  );
  return modules.flatMap((module) => Object.values(module).filter(isNamespaceConfig));
}

function countDefineConfigCalls(): number {
  return CONFIG_FILES.reduce(
    (count, file) =>
      count +
      (readFileSync(resolve(SOURCE_ROOT, file), "utf8").match(/= defineConfig\(/g) ?? []).length,
    0,
  );
}

/** validateEnv가 거부한 오류 문구. 통과하면 빈 문자열이다. */
function refusalOf(env: Env): string {
  try {
    validateEnv(env);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("env 예시에 운영 값을 넣어 시작하는 설정", () => {
  let module: TestingModule | undefined;
  let namespaces: AnyNamespaceConfig[];

  beforeAll(async () => {
    namespaces = await loadNamespaceConfigs();
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
    constructedPgBossOptions.length = 0;
  });

  /** 앱처럼 원문 env를 process.env에 두고 모든 namespace 설정과 pg-boss client를 만든다. */
  async function bootConfig(env: Env): Promise<TestingModule> {
    // 예시에 없는 키는 비워 개발 셸의 env가 섞이지 않게 한다
    for (const key of envSchema.keyof().options) {
      vi.stubEnv(key, env[key]);
    }
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, validate: validateEnv, load: namespaces }),
      ],
      providers: [pgBossClientProvider],
    }).compile();
    return module;
  }

  it("src의 defineConfig 설정을 빠짐없이 모은다", () => {
    // Then
    expect(namespaces).toHaveLength(countDefineConfigCalls());
    expect(namespaces.map((namespace) => namespace.namespace)).toEqual(
      expect.arrayContaining(["app", "database", "job", "billingSubscriptions"]),
    );
  });

  it("운영에서 바꾸는 키는 모두 예시에 값이나 주석으로 있다", () => {
    // Given
    const text = exampleText();

    // When
    const missing = Object.keys(PRODUCTION_VALUES).filter(
      (key) => !new RegExp(`^(# )?${key}=`, "m").test(text),
    );

    // Then
    expect(missing).toEqual([]);
  });

  it("운영 값을 넣으면 운영 시작 검증을 통과한다", () => {
    // Given
    const env = productionEnv();

    // When
    const refusal = refusalOf(env);

    // Then
    expect(refusal).toBe("");
  });

  it("모든 namespace 설정과 pg-boss client가 운영 env 원문으로 오류 없이 만들어진다", async () => {
    // Given
    const env = productionEnv();

    // When
    const booted = await bootConfig(env);
    const boss = booted.get<PgBossClient>(PG_BOSS_CLIENT);
    await boss.start();

    // Then
    for (const namespace of namespaces) {
      expect(booted.get(namespace.KEY)).toEqual(namespace.parse(env));
    }
    const appPool = createPostgresPoolConfig(env.DATABASE_URL ?? "");
    expect(constructedPgBossOptions).toEqual([
      expect.objectContaining({
        connectionString: appPool.connectionString,
        ssl: appPool.ssl,
        options: appPool.options,
        application_name: "aido-pg-boss",
        max: 3,
        schema: env.JOB_SCHEMA,
      }),
    ]);
    await boss.stop();
  });

  it.each([
    { rule: "메일 공급자 log", key: "EMAIL_PROVIDER", change: { EMAIL_PROVIDER: "log" } },
    { rule: "Resend 키 없음", key: "RESEND_API_KEY", change: { RESEND_API_KEY: "" } },
    {
      rule: "관리자 알림 log",
      key: "ADMIN_NOTIFIER_PROVIDER",
      change: { ADMIN_NOTIFIER_PROVIDER: "log" },
    },
    {
      rule: "웹훅 비밀 없음",
      key: "REVENUECAT_WEBHOOK_SECRET",
      change: { REVENUECAT_WEBHOOK_SECRET: "" },
    },
    {
      rule: "로그인 공급자 없음",
      key: "OAUTH",
      change: { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined },
    },
    {
      rule: "WeatherKit 자격 일부 없음",
      key: "WEATHERKIT_PRIVATE_KEY",
      change: { WEATHERKIT_PRIVATE_KEY: undefined },
    },
    {
      rule: "짧은 초대 해시 비밀",
      key: "INVITE_CLAIM_HASH_SECRET",
      change: { INVITE_ENABLED: "true", INVITE_CLAIM_HASH_SECRET: "short-invite-secret" },
    },
  ])("운영에서 $rule이면 키 이름만 적고 값 없이 시작을 거부한다", ({ key, change }) => {
    // Given
    const env = { ...productionEnv(), ...change };
    const values = Object.values(env).filter((value) => value != null && value.length >= 12);

    // When
    const refusal = refusalOf(env);

    // Then
    expect(refusal).toContain(`${key}:`);
    for (const value of values) {
      expect(refusal).not.toContain(value);
    }
  });

  it("배포된 개발서버는 운영 비밀 없이 최소 키로 설정을 만든다", async () => {
    // When
    const booted = await bootConfig(DEPLOYED_DEV_SERVER_ENV);

    // Then
    for (const namespace of namespaces) {
      expect(booted.get(namespace.KEY)).toEqual(namespace.parse(DEPLOYED_DEV_SERVER_ENV));
    }
    expect(booted.get(PG_BOSS_CLIENT)).toBeDefined();
  });
});
