import { ErrorCode } from "@aido/errors";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

/**
 * 검색 결과 keyset 커서.
 * 관련도 랭킹(rank)은 계산값이라 id만으로는 안정적 페이지네이션이 불가능하다.
 * 따라서 (rank, id) 복합 키를 불투명 문자열로 인코딩한다.
 * - `rank`: 관련도 버킷 (0=정확 태그, 1=태그 prefix, 2=이름 prefix, 3=contains)
 * - `id`: 사용자 CUID (문자열, 콜론 미포함이라 첫 콜론 기준 분할 안전)
 */
export interface SearchCursor {
	rank: number;
	id: string;
}

/** (rank, id) → 불투명 base64url 문자열 */
export function encodeSearchCursor(cursor: SearchCursor): string {
	return Buffer.from(`${cursor.rank}:${cursor.id}`, "utf8").toString(
		"base64url",
	);
}

/**
 * 불투명 문자열 → (rank, id). 형식이 올바르지 않으면 FOLLOW_0912를 던진다.
 */
export function decodeSearchCursor(raw: string): SearchCursor {
	const decoded = Buffer.from(raw, "base64url").toString("utf8");
	const separatorIndex = decoded.indexOf(":");
	if (separatorIndex <= 0) {
		throw new ApplicationException(ErrorCode.FOLLOW_0912, { cursor: raw });
	}

	const rankPart = decoded.slice(0, separatorIndex);
	const id = decoded.slice(separatorIndex + 1);
	const rank = Number(rankPart);

	if (!Number.isInteger(rank) || rank < 0 || id.length === 0) {
		throw new ApplicationException(ErrorCode.FOLLOW_0912, { cursor: raw });
	}

	return { rank, id };
}
