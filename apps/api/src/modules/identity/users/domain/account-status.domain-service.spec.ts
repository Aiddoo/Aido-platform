import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { assertStatusAllowsLogin } from "./account-status.domain-service.js";

describe("account-status-policy 도메인 서비스", () => {
  describe("assertStatusAllowsLogin", () => {
    it("LOCKED 계정은 로그인을 거부한다 (USER_0607)", () => {
      try {
        // When
        assertStatusAllowsLogin("LOCKED", "user@example.com");
        throw new Error("예외가 발생해야 한다");
      } catch (error) {
        // Then
        expect(error).toBeInstanceOf(DomainException);
        if (error instanceof DomainException) {
          expect(error.errorCode).toBe(ErrorCode.USER_0607);
          expect(error.details).toEqual({ email: "user@example.com" });
        }
      }
    });

    it("SUSPENDED 계정은 로그인을 거부한다 (USER_0605)", () => {
      try {
        // When
        assertStatusAllowsLogin("SUSPENDED", "user-123");
        throw new Error("예외가 발생해야 한다");
      } catch (error) {
        // Then
        expect(error).toBeInstanceOf(DomainException);
        if (error instanceof DomainException) {
          expect(error.errorCode).toBe(ErrorCode.USER_0605);
          expect(error.details).toEqual({ userId: "user-123" });
        }
      }
    });

    it("ACTIVE 계정은 상태 게이트를 통과한다", () => {
      // When
      const assertLogin = () => assertStatusAllowsLogin("ACTIVE", "user@example.com");

      // Then
      expect(assertLogin).not.toThrow();
    });

    it("PENDING_VERIFY 계정은 상태 게이트를 통과한다", () => {
      // When
      const assertLogin = () => assertStatusAllowsLogin("PENDING_VERIFY", "user@example.com");

      // Then
      expect(assertLogin).not.toThrow();
    });
  });
});
