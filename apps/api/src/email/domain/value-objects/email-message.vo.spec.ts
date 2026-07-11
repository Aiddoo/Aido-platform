/**
 * EmailMessage 값 객체 단위 테스트
 *
 * 명명 팩토리가 종류별 제목·태그를 조립하고 불변식을 강제하는지 검증한다.
 */
import { EmailMessage } from "./email-message.vo";

describe("EmailMessage 값 객체", () => {
	describe("verificationCode", () => {
		it("인증 제목과 type=verification 태그로 조립한다", () => {
			const message = EmailMessage.verificationCode("user@test.com", {
				code: "123456",
				expiryMinutes: 10,
			});

			expect(message.to).toBe("user@test.com");
			expect(message.subject).toBe("[Aido] 이메일 인증 코드");
			expect(message.text).toContain("123456");
			expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
			expect(message.idempotencyKey).toBeUndefined();
		});

		it("idempotencyKey를 보존한다", () => {
			const message = EmailMessage.verificationCode(
				"user@test.com",
				{ code: "123456", expiryMinutes: 10 },
				"idem-1",
			);
			expect(message.idempotencyKey).toBe("idem-1");
		});
	});

	describe("inquiry", () => {
		it("type·category 태그를 함께 붙인다", () => {
			const message = EmailMessage.inquiry("support@test.com", {
				userEmail: "user@test.com",
				category: "BUG_REPORT",
				categoryLabel: "버그 신고",
				content: "내용",
				submittedAt: "2026-03-09 10:00",
			});

			expect(message.subject).toContain("버그 신고");
			expect(message.tags).toEqual([
				{ name: "type", value: "inquiry" },
				{ name: "category", value: "BUG_REPORT" },
			]);
		});
	});

	describe("withTag", () => {
		it("태그를 추가한 새 인스턴스를 반환하고 원본은 불변이다", () => {
			const original = EmailMessage.verificationCode("user@test.com", {
				code: "123456",
				expiryMinutes: 10,
			});

			const tagged = original.withTag({ name: "environment", value: "test" });

			expect(tagged).not.toBe(original);
			expect(original.tags).toHaveLength(1);
			expect(tagged.tags).toEqual([
				{ name: "type", value: "verification" },
				{ name: "environment", value: "test" },
			]);
		});
	});

	describe("불변식", () => {
		it("수신자가 비어 있으면 생성에 실패한다", () => {
			expect(() =>
				EmailMessage.verificationCode("   ", {
					code: "123456",
					expiryMinutes: 10,
				}),
			).toThrow();
		});
	});
});
