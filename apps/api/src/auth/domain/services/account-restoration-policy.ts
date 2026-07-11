import { ErrorCode } from "@aido/errors";

import { ACCOUNT_DELETION } from "@/auth/domain/constants/auth.constants";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * 탈퇴(soft-delete) 계정의 복구 가능성 불변식.
 *
 * 이메일 로그인(AuthService)과 소셜 로그인(OAuthService)이 분산 소유하던
 * "탈퇴 계정은 유예 기간(30일) 이내에만 복구 가능" 규칙을 도메인이 소유한다.
 *
 * @returns 복구가 필요한지 여부
 *   - `deletedAt`이 null이면 `false` (탈퇴 아님 → 복구 불필요)
 *   - 유예 기간 이내면 `true` (복구 필요 — 호출측이 원자적 복구 수행)
 * @throws DomainException(USER_0606) 유예 기간(30일)을 초과한 탈퇴 계정
 *   (cron이 아직 hard delete 처리하지 못한 edge case — 복구 거부)
 */
export function assertRestorableWithinGracePeriod(
	deletedAt: Date | null,
	userId: string,
): boolean {
	if (!deletedAt) {
		return false;
	}

	const gracePeriodCutoff = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
	if (deletedAt > gracePeriodCutoff) {
		return true;
	}

	throw new DomainException(ErrorCode.USER_0606, { userId });
}
