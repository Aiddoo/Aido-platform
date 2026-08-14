/**
 * TransactionalEmailSender 단위 테스트
 *
 * 각 메서드가 올바른 EmailMessage를 조립해 EMAIL_SENDER 포트에 위임하는지
 * 스텁 sender로 검증한다 (실제 발송 없음).
 */
import type { EmailSenderPort } from "../ports/email-sender.port";
import { TransactionalEmailSender } from "../senders/transactional-email.sender";

describe("TransactionalEmailSender — 트랜잭션 이메일 발송", () => {
	let emailSender: TransactionalEmailSender;
	let sender: jest.Mocked<EmailSenderPort>;

	beforeEach(() => {
		sender = { send: jest.fn() };
		emailSender = new TransactionalEmailSender(sender);
		sender.send.mockResolvedValue({ success: true, messageId: "id-1" });
	});

	it("sendVerificationCode는 인증 메시지를 조립해 전송한다", async () => {
		const result = await emailSender.sendVerificationCode(
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
		await emailSender.sendInquiry("support@test.com", {
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
