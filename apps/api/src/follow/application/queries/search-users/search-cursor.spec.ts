/**
 * search-cursor 코덱 단위 테스트.
 *
 * (rank, id) 복합 키의 인코딩/디코딩 라운드트립과 손상된 커서 방어(FOLLOW_0912)를 검증한다.
 */
import { ErrorCode } from "@aido/errors";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor";

describe("search-cursor — keyset 커서 코덱", () => {
	it("인코딩 후 디코딩하면 원본 (rank, id)를 복원한다", () => {
		const cursor = { rank: 2, id: "clz7x5p8k0005qz0z8z8z8z8z" };
		const encoded = encodeSearchCursor(cursor);
		expect(decodeSearchCursor(encoded)).toEqual(cursor);
	});

	it("rank가 0인 경우도 복원한다", () => {
		const cursor = { rank: 0, id: "clz7x5p8k0001qz0z8z8z8z8z" };
		expect(decodeSearchCursor(encodeSearchCursor(cursor))).toEqual(cursor);
	});

	it("손상된 커서 문자열은 FOLLOW_0912를 던진다", () => {
		try {
			// 콜론 없이 디코딩되는 문자열 → 유효하지 않은 커서
			decodeSearchCursor("notavalidcursor");
			fail("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ApplicationException);
			if (error instanceof ApplicationException) {
				expect(error.errorCode).toBe(ErrorCode.FOLLOW_0912);
			}
		}
	});

	it("구분자가 없는 커서는 FOLLOW_0912를 던진다", () => {
		const noSeparator = Buffer.from("justtext", "utf8").toString("base64url");
		expect(() => decodeSearchCursor(noSeparator)).toThrow(ApplicationException);
	});
});
