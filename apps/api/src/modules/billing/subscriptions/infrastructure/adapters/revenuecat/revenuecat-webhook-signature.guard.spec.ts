import { Logger } from "@nestjs/common";

import { ApplicationException } from "#api/shared/application/application.exception";
import { createMockExecutionContext } from "#test/mocks/index";

import { billingSubscriptionsConfig } from "../../../billing-subscriptions.config.js";
import { RevenueCatWebhookSignatureGuard } from "./revenuecat-webhook-signature.guard.js";

function guardFor(
  env: Readonly<Record<string, string | undefined>>,
): RevenueCatWebhookSignatureGuard {
  return new RevenueCatWebhookSignatureGuard(billingSubscriptionsConfig.parse(env));
}

function requestWith(authorization?: string) {
  return createMockExecutionContext({
    headers: authorization == null ? {} : { authorization },
  }).context;
}

describe("RevenueCatWebhookSignatureGuard — 가드", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  describe("webhook secret이 설정된 운영", () => {
    const guard = guardFor({
      NODE_ENV: "production",
      APP_ENV: "production",
      REVENUECAT_WEBHOOK_SECRET: "test-secret",
    });

    it("Bearer를 붙인 올바른 Authorization은 통과한다", () => {
      // When
      const allowed = guard.canActivate(requestWith("Bearer test-secret"));

      // Then
      expect(allowed).toBe(true);
    });

    it("Bearer 없이 보낸 올바른 값도 통과한다", () => {
      // When
      const allowed = guard.canActivate(requestWith("test-secret"));

      // Then
      expect(allowed).toBe(true);
    });

    it.each([
      { name: "Authorization 없음", authorization: undefined },
      { name: "다른 값", authorization: "Bearer wrong-secret" },
      { name: "길이가 다른 값", authorization: "Bearer short" },
    ])("$name은 거절한다", ({ authorization }) => {
      // When
      const check = () => guard.canActivate(requestWith(authorization));

      // Then
      expect(check).toThrow(ApplicationException);
    });
  });

  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" } },
    { name: "배포된 개발서버", env: { NODE_ENV: "production", APP_ENV: "development" } },
  ])("$name은 secret이 없으면 검증을 건너뛰고 통과시킨다", ({ env }) => {
    // Given
    const guard = guardFor(env);

    // When
    const allowed = guard.canActivate(requestWith());

    // Then
    expect(allowed).toBe(true);
  });

  it.each([
    { name: "스테이징", env: { NODE_ENV: "production", APP_ENV: "staging" } },
    { name: "운영", env: { NODE_ENV: "production", APP_ENV: "production" } },
    { name: "APP_ENV 없는 운영", env: { NODE_ENV: "production" } },
    {
      name: "빈 문자열 secret의 운영",
      env: { NODE_ENV: "production", APP_ENV: "production", REVENUECAT_WEBHOOK_SECRET: "" },
    },
  ])("$name은 secret이 없으면 Authorization을 보내도 모두 거절한다", ({ env }) => {
    // Given
    const guard = guardFor(env);

    // When
    const check = () => guard.canActivate(requestWith("Bearer anything"));

    // Then
    expect(check).toThrow(ApplicationException);
  });
});
