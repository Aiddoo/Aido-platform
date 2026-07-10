/**
 * MemoContent 값 객체 단위 테스트
 */
import { MEMO_LIMITS } from "@aido/validators";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { MemoContent } from "./memo-content.vo";

describe("MemoContent — 메모 내용 값 객체", () => {
	describe("of", () => {
		it("유효 범위 내 내용을 생성한다", () => {
			expect(MemoContent.of("할 일").value).toBe("할 일");
		});

		it("빈 문자열은 DomainException(SYS_0002)을 던진다", () => {
			expect(() => MemoContent.of("")).toThrow(DomainException);
			expect(() => MemoContent.of("")).toThrow(
				expect.objectContaining({ errorCode: "SYS_0002" }),
			);
		});

		it("최대 길이를 초과하면 DomainException을 던진다", () => {
			const tooLong = "a".repeat(MEMO_LIMITS.MAX_CONTENT_LENGTH + 1);
			expect(() => MemoContent.of(tooLong)).toThrow(DomainException);
		});

		it("경계값(최대 길이)은 허용한다", () => {
			const atLimit = "a".repeat(MEMO_LIMITS.MAX_CONTENT_LENGTH);
			expect(MemoContent.of(atLimit).value.length).toBe(
				MEMO_LIMITS.MAX_CONTENT_LENGTH,
			);
		});
	});

	describe("toTodoTitle", () => {
		it("200자 이하는 그대로 반환한다", () => {
			expect(MemoContent.of("짧은 메모").toTodoTitle()).toBe("짧은 메모");
		});

		it("200자를 초과하면 앞 200자로 잘린다", () => {
			const title = MemoContent.of("x".repeat(300)).toTodoTitle();
			expect(title.length).toBe(200);
		});
	});
});
