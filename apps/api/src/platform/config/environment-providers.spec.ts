import { Redis } from "ioredis";

import { notificationEmailConfig } from "#api/modules/notification/email/notification-email.config";
import { operationsAdminNoticesConfig } from "#api/modules/operations/admin-notices/operations-admin-notices.config";

import { cacheConfig, selectSharedRedis } from "./cache.config.js";

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1/token";

describe("배포 환경 → 공급자 기본값", () => {
  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" }, email: "log", adminNotifier: "log" },
    {
      name: "키가 없는 개발서버",
      env: { NODE_ENV: "production", APP_ENV: "development" },
      email: "log",
      adminNotifier: "log",
    },
    {
      name: "키가 있는 개발서버",
      env: {
        NODE_ENV: "production",
        APP_ENV: "development",
        RESEND_API_KEY: "re_dev_key",
        DISCORD_SIGNUP_WEBHOOK_URL: DISCORD_WEBHOOK_URL,
      },
      email: "resend",
      adminNotifier: "discord",
    },
    {
      name: "스테이징",
      env: { NODE_ENV: "production", APP_ENV: "staging" },
      email: "resend",
      adminNotifier: "discord",
    },
    {
      name: "운영",
      env: { NODE_ENV: "production", APP_ENV: "production" },
      email: "resend",
      adminNotifier: "discord",
    },
    {
      name: "APP_ENV 없는 운영",
      env: { NODE_ENV: "production" },
      email: "resend",
      adminNotifier: "discord",
    },
  ])(
    "$name은 비워 둔 공급자를 이메일 $email·관리자 알림 $adminNotifier로 고른다",
    ({ env, email, adminNotifier }) => {
      // When
      const emailConfig = notificationEmailConfig.parse(env);
      const adminNoticesConfig = operationsAdminNoticesConfig.parse(env);

      // Then
      expect(emailConfig.provider).toBe(email);
      expect(adminNoticesConfig.provider).toBe(adminNotifier);
    },
  );

  it("env에 적은 공급자는 배포 환경 기본값보다 앞선다", () => {
    // Given
    const env = {
      NODE_ENV: "development",
      EMAIL_PROVIDER: "resend",
      ADMIN_NOTIFIER_PROVIDER: "discord",
    };

    // When
    const emailConfig = notificationEmailConfig.parse(env);
    const adminNoticesConfig = operationsAdminNoticesConfig.parse(env);

    // Then
    expect(emailConfig.provider).toBe("resend");
    expect(adminNoticesConfig.provider).toBe("discord");
  });

  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" } },
    { name: "스테이징", env: { NODE_ENV: "production", APP_ENV: "staging" } },
    { name: "운영", env: { NODE_ENV: "production", APP_ENV: "production" } },
  ])("$name의 캐시·잠금·중복 방지·스로틀 저장소 기본값은 프로세스 안 memory다", ({ env }) => {
    // Given
    const redis = new Redis({ lazyConnect: true });

    // When
    const shared = selectSharedRedis(cacheConfig.parse(env), redis);

    // Then
    expect(shared).toBeNull();
    redis.disconnect();
  });

  it("CACHE_TYPE=redis는 Redis 연결이 있을 때만 그 연결을 함께 쓴다", () => {
    // Given
    const cache = cacheConfig.parse({ CACHE_TYPE: "redis" });
    const redis = new Redis({ lazyConnect: true });

    // When
    const withClient = selectSharedRedis(cache, redis);
    const withoutClient = selectSharedRedis(cache, null);

    // Then
    expect(withClient).toBe(redis);
    expect(withoutClient).toBeNull();
    redis.disconnect();
  });
});
