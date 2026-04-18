import { maskEmail, maskUserId } from "./mask.util";

describe("mask.util — 로깅 마스킹 유틸", () => {
	describe("maskEmail", () => {
		it("일반 이메일은 로컬파트 첫 글자만 남기고 마스킹한다", () => {
			// Given
			const email = "yongmin@crabit.co.kr";

			// When
			const result = maskEmail(email);

			// Then
			expect(result).toBe("y***@crabit.co.kr");
		});

		it("로컬파트가 1자인 이메일도 정상 처리한다", () => {
			// Given
			const email = "a@b.com";

			// When
			const result = maskEmail(email);

			// Then
			expect(result).toBe("a***@b.com");
		});

		it("@ 가 없는 문자열은 <invalid> 로 표기한다", () => {
			// Given
			const invalid = "not-an-email";

			// When
			const result = maskEmail(invalid);

			// Then
			expect(result).toBe("<invalid>");
		});

		it("빈 문자열은 <invalid> 로 표기한다", () => {
			// Given
			const empty = "";

			// When
			const result = maskEmail(empty);

			// Then
			expect(result).toBe("<invalid>");
		});

		it("로컬파트가 비어있는 @domain 은 ***@domain 로 표기한다", () => {
			// Given
			const email = "@example.com";

			// When
			const result = maskEmail(email);

			// Then
			expect(result).toBe("***@example.com");
		});
	});

	describe("maskUserId", () => {
		it("cuid 앞 6자만 남기고 말줄임표를 붙인다", () => {
			// Given
			const userId = "cmmxmf9tx000f1ysse29t7981";

			// When
			const result = maskUserId(userId);

			// Then
			expect(result).toBe("cmmxmf…");
		});

		it("6자 이하 ID 도 말줄임표로 마무리한다", () => {
			// Given
			const short = "abc";

			// When
			const result = maskUserId(short);

			// Then
			expect(result).toBe("abc…");
		});

		it("빈 문자열은 <empty> 로 표기한다", () => {
			// Given
			const empty = "";

			// When
			const result = maskUserId(empty);

			// Then
			expect(result).toBe("<empty>");
		});
	});
});
