import { Logger } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";

import { ApplicationException } from "#api/shared/application/application.exception";

import { RevenueCatWebhookSignatureGuard } from "./revenuecat-webhook-signature.guard.js";

function createGuard(config: {
  readonly webhookSecret: string;
  readonly isProduction?: boolean;
}): RevenueCatWebhookSignatureGuard {
  return new RevenueCatWebhookSignatureGuard(
    {
      revenuecat: {
        webhookSecret: config.webhookSecret,
        projectId: undefined,
        apiV2SecretKey: undefined,
      },
    },
    { nodeEnv: config.isProduction === true ? "production" : "test" },
  );
}

function requestWith(headers: Record<string, string>): ExecutionContextHost {
  return new ExecutionContextHost([{ headers }]);
}

describe("RevenueCatWebhookSignatureGuard — 가드", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  describe("webhook secret이 설정된 경우", () => {
    let guard: RevenueCatWebhookSignatureGuard;

    beforeEach(() => {
      guard = createGuard({ webhookSecret: "test-secret" });
    });

    it("올바른 Authorization 헤더 → 통과 (true)", () => {
      const context = requestWith({ authorization: "Bearer test-secret" });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("Authorization 헤더 없음 → ApplicationException", () => {
      const context = requestWith({});

      expect(() => guard.canActivate(context)).toThrow(ApplicationException);
    });

    it("잘못된 값 → ApplicationException", () => {
      const context = requestWith({ authorization: "Bearer wrong-secret" });

      expect(() => guard.canActivate(context)).toThrow(ApplicationException);
    });

    it("길이가 다른 토큰 → 거부", () => {
      const context = requestWith({ authorization: "Bearer short" });

      expect(() => guard.canActivate(context)).toThrow(ApplicationException);
    });

    it("Bearer prefix 없는 raw 값 → 통과 (true)", () => {
      const context = requestWith({ authorization: "test-secret" });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("webhook secret이 미설정된 경우 (개발 환경)", () => {
    it("secret 미설정 → 통과 (true)", () => {
      const guard = createGuard({ webhookSecret: "", isProduction: false });
      const context = requestWith({});

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("webhook secret이 미설정된 경우 (프로덕션 환경)", () => {
    it("프로덕션 + secret 미설정 → ApplicationException", () => {
      const guard = createGuard({ webhookSecret: "", isProduction: true });
      const context = requestWith({});

      expect(() => guard.canActivate(context)).toThrow(ApplicationException);
    });
  });
});
