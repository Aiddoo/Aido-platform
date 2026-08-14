import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { assertStatusAllowsLogin } from "./account-status-policy";

describe("account-status-policy 도메인 서비스", () => {
	describe("assertStatusAllowsLogin", () => {
		it("LOCKED 계정은 로그인을 거부한다 (USER_0607)", () => {
			try {
				assertStatusAllowsLogin("LOCKED", "user@example.com");
				throw new Error("예외가 발생해야 한다");
			} catch (error) {
				expect(error).toBeInstanceOf(DomainException);
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.USER_0607);
					expect(error.details).toEqual({ email: "user@example.com" });
				}
			}
		});

		it("SUSPENDED 계정은 로그인을 거부한다 (USER_0605)", () => {
			try {
				assertStatusAllowsLogin("SUSPENDED", "user-123");
				throw new Error("예외가 발생해야 한다");
			} catch (error) {
				expect(error).toBeInstanceOf(DomainException);
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.USER_0605);
					expect(error.details).toEqual({ userId: "user-123" });
				}
			}
		});

		it("ACTIVE 계정은 상태 게이트를 통과한다", () => {
			expect(() => assertStatusAllowsLogin("ACTIVE", "user@example.com")).not.toThrow();
		});

		it("PENDING_VERIFY 계정은 상태 게이트를 통과한다", () => {
			expect(() => assertStatusAllowsLogin("PENDING_VERIFY", "user@example.com")).not.toThrow();
		});
	});
});
