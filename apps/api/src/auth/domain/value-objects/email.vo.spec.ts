import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { Email } from "./email.vo";

describe("Email 값 객체", () => {
	describe("of", () => {
		it("유효한 이메일은 값 그대로 통과한다(정규화 없음)", () => {
			expect(Email.of("user@example.com").value).toBe("user@example.com");
		});

		it("합성 소셜 이메일 형식(underscore 로컬파트)도 유효하다", () => {
			// 이 경로로는 쓰이지 않지만 형식 자체는 유효함을 문서화
			expect(Email.of("naver_1234567@social.aido.kr").value).toBe(
				"naver_1234567@social.aido.kr",
			);
		});

		it("대소문자를 보존한다(프레젠테이션 emailSchema가 소문자화 소유)", () => {
			expect(Email.of("User@Example.com").value).toBe("User@Example.com");
		});

		it("형식이 잘못된 이메일은 DomainException(SYS_0002)을 던진다", () => {
			try {
				Email.of("not-an-email");
				throw new Error("예외가 발생해야 한다");
			} catch (error) {
				expect(error).toBeInstanceOf(DomainException);
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.SYS_0002);
					expect(error.details).toEqual({ email: "not-an-email" });
				}
			}
		});

		it("255자를 초과하는 이메일은 거부한다", () => {
			const tooLong = `${"a".repeat(250)}@example.com`;
			expect(() => Email.of(tooLong)).toThrow(DomainException);
		});
	});

	describe("equals", () => {
		it("동일 주소는 같다고 판정한다", () => {
			expect(Email.of("a@b.com").equals(Email.of("a@b.com"))).toBe(true);
		});

		it("다른 주소는 다르다고 판정한다", () => {
			expect(Email.of("a@b.com").equals(Email.of("c@d.com"))).toBe(false);
		});
	});
});
