import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * 계정 상태 로그인 가능성 불변식.
 *
 * 자격 증명 인증 흐름과 OAuth 인증 흐름이 공유하던 상태 게이트를
 * 도메인이 소유한다. LOCKED/SUSPENDED는 로그인을 거부하고, 그 외(ACTIVE/PENDING_VERIFY
 * 및 알 수 없는 값)는 이 정책에서 처리하지 않는다(호출측의 인증/복구 흐름이 담당).
 *
 * status를 넓은 string으로 받는 이유: 호출측 읽기 모델의 status 타입이
 * UserStatus 유니온과 raw string으로 혼재하며, 스위치가 LOCKED/SUSPENDED만
 * 판정하고 나머지는 통과시키므로 기존 동작과 byte-identical하다.
 *
 * @param identifier 오류 details에 담을 사용자 식별자(이메일 로그인=email,
 *   소셜 로그인=식별 불가 시 플레이스홀더). 기존 계약을 그대로 보존한다.
 */
export function assertStatusAllowsLogin(
	status: string,
	identifier: string,
): void {
	switch (status) {
		case "LOCKED":
			throw new DomainException(ErrorCode.USER_0607, {
				email: identifier,
				remainingMinutes: undefined,
			});
		case "SUSPENDED":
			throw new DomainException(ErrorCode.USER_0605, { userId: identifier });
		default:
			// ACTIVE, PENDING_VERIFY는 상태 게이트에서 통과
			break;
	}
}
