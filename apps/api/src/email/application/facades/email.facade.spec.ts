/**
 * EmailFacade 단위 테스트
 *
 * 각 메서드가 올바른 EmailMessage를 조립해 EMAIL_SENDER 포트에 위임하는지
 * 스텁 sender로 검증한다 (실제 발송 없음).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { EMAIL_SENDER, type EmailSenderPort } from "../ports/email-sender.port";
import { EmailFacade } from "./email.facade";

describe("EmailFacade — 이메일 파사드", () => {
	let facade: EmailFacade;
	let sender: Mocked<EmailSenderPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(EmailFacade).compile();
		facade = unit;
		sender = unitRef.get(EMAIL_SENDER);
		sender.send.mockResolvedValue({ success: true, messageId: "id-1" });
	});

	it("sendVerificationCode는 인증 메시지를 조립해 전송한다", async () => {
		const result = await facade.sendVerificationCode(
			"user@test.com",
			{ code: "123456", expiryMinutes: 10 },
			"idem-1",
		);

		const message = sender.send.mock.calls[0]?.[0];
		expect(message?.to).toBe("user@test.com");
		expect(message?.subject).toBe("[Aido] 이메일 인증 코드");
		expect(message?.tags).toEqual([{ name: "type", value: "verification" }]);
		expect(message?.idempotencyKey).toBe("idem-1");
		expect(result).toEqual({ success: true, messageId: "id-1" });
	});

	it("sendInquiry는 문의 메시지를 조립해 전송한다", async () => {
		await facade.sendInquiry("support@test.com", {
			userEmail: "user@test.com",
			category: "OTHER",
			categoryLabel: "기타",
			content: "내용",
			submittedAt: "2026-03-09 10:00",
		});

		const message = sender.send.mock.calls[0]?.[0];
		expect(message?.tags).toEqual([
			{ name: "type", value: "inquiry" },
			{ name: "category", value: "OTHER" },
		]);
	});
});
