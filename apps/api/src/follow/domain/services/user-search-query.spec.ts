/**
 * user-search-query 도메인 서비스 단위 테스트.
 *
 * 검색어 정규화(NFC 결합·공백 정리·대문자 태그)와 빈 검색어 방어(FOLLOW_0911)를 검증한다.
 */
import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { normalizeUserSearchQuery } from "./user-search-query";

describe("normalizeUserSearchQuery — 검색어 정규화", () => {
	it("영문 검색어를 trim하고 upperTag를 대문자화한다", () => {
		const result = normalizeUserSearchQuery("  john  ");
		expect(result.nfc).toBe("john");
		expect(result.upperTag).toBe("JOHN");
	});

	it("연속 공백을 단일 공백으로 정리한다", () => {
		const result = normalizeUserSearchQuery("hong   gil    dong");
		expect(result.nfc).toBe("hong gil dong");
	});

	it("분해된(NFD) 한글 자모를 NFC로 결합한다", () => {
		// "홍" = ㅎ+ㅗ+ㅇ 분해형
		const decomposed = "홍";
		const composed = "홍"; // 홍
		expect(decomposed).not.toBe(composed);

		const result = normalizeUserSearchQuery(decomposed);
		expect(result.nfc).toBe(composed);
	});

	it("공백만 있는 검색어는 FOLLOW_0911을 던진다", () => {
		expect(() => normalizeUserSearchQuery("   ")).toThrow(DomainException);
		try {
			normalizeUserSearchQuery("   ");
			fail("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(DomainException);
			if (error instanceof DomainException) {
				expect(error.errorCode).toBe(ErrorCode.FOLLOW_0911);
			}
		}
	});
});
