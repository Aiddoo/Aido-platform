import { ErrorCode } from "@aido/errors";

import { ACCOUNT_DELETION } from "@/auth/domain/constants/auth.constants";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { assertRestorableWithinGracePeriod } from "./account-restoration-policy";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("account-restoration-policy 도메인 서비스", () => {
	describe("assertRestorableWithinGracePeriod", () => {
		it("deletedAt이 null이면 복구 불필요(false)를 반환한다", () => {
			expect(assertRestorableWithinGracePeriod(null, "user-123")).toBe(false);
		});

		it("유예 기간 이내 탈퇴 계정은 복구 필요(true)를 반환한다", () => {
			const withinGrace = new Date(
				Date.now() - (ACCOUNT_DELETION.GRACE_PERIOD_DAYS - 1) * DAY_MS,
			);
			expect(assertRestorableWithinGracePeriod(withinGrace, "user-123")).toBe(
				true,
			);
		});

		it("유예 기간 초과 탈퇴 계정은 DomainException(USER_0606)을 던진다", () => {
			const pastGrace = new Date(
				Date.now() - (ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1) * DAY_MS,
			);
			try {
				assertRestorableWithinGracePeriod(pastGrace, "user-123");
				throw new Error("예외가 발생해야 한다");
			} catch (error) {
				expect(error).toBeInstanceOf(DomainException);
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.USER_0606);
					expect(error.details).toEqual({ userId: "user-123" });
				}
			}
		});
	});
});
