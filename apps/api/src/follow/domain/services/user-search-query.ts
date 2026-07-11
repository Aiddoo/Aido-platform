import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * 정규화된 사용자 검색어.
 * - `nfc`: NFC 정규화 + 공백 정리된 검색어 (UserProfile.name ILIKE 매칭에 사용)
 * - `upperTag`: 대문자화된 검색어 (userTag 매칭에 사용, 태그는 [A-Z0-9] 저장)
 */
export interface NormalizedSearchQuery {
	nfc: string;
	upperTag: string;
}

/**
 * normalizeUserSearchQuery — 사용자 검색어 정규화(순수 함수).
 *
 * iOS/macOS 클라이언트는 분해된(NFD) 한글 자모를 보낼 수 있어 NFC로 결합하고,
 * 연속 공백을 단일 공백으로 정리한다. 정규화 후 빈 문자열이면 FOLLOW_0911을 던진다.
 * (프레젠테이션 zod가 1차 게이트지만 도메인 경계에서도 방어한다.)
 */
export function normalizeUserSearchQuery(input: string): NormalizedSearchQuery {
	const nfc = input.normalize("NFC").trim().replace(/\s+/g, " ");
	if (nfc.length === 0) {
		throw new DomainException(ErrorCode.FOLLOW_0911, { query: input });
	}
	return { nfc, upperTag: nfc.toUpperCase() };
}
