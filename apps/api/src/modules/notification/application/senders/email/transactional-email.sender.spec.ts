import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import type { EmailSenderPort, EmailSendResult } from "../../ports/email/email-sender.port.js";
import { TransactionalEmailSender } from "./transactional-email.sender.js";

class StubEmailSender implements EmailSenderPort {
  readonly messages: EmailMessage[] = [];

  constructor(readonly result: EmailSendResult = { success: true, messageId: "id-1" }) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(message);
    return this.result;
  }
}

describe("TransactionalEmailSender — 트랜잭션 이메일 발송", () => {
  let emailSender: TransactionalEmailSender;
  let sender: StubEmailSender;

  beforeEach(() => {
    sender = new StubEmailSender();
    emailSender = new TransactionalEmailSender(sender);
  });

  it("sendVerificationCode는 인증 메시지를 조립해 전송한다", async () => {
    // Given - beforeEach에서 새 Port Stub을 준비

    // When
    const result = await emailSender.sendVerificationCode(
      "user@test.com",
      { code: "123456", expiryMinutes: 10 },
      "idem-1",
    );

    // Then
    const message = sender.messages[0];
    expect(message?.to).toBe("user@test.com");
    expect(message?.subject).toBe("[Aido] 이메일 인증 코드");
    expect(message?.tags).toEqual([{ name: "type", value: "verification" }]);
    expect(message?.idempotencyKey).toBe("idem-1");
    expect(result).toEqual({ success: true, messageId: "id-1" });
  });

  it("sendInquiry는 문의 메시지를 조립해 전송한다", async () => {
    // Given - beforeEach에서 새 Port Stub을 준비

    // When
    await emailSender.sendInquiry("support@test.com", {
      userEmail: "user@test.com",
      category: "OTHER",
      categoryLabel: "기타",
      content: "내용",
      submittedAt: "2026-03-09 10:00",
    });

    // Then
    const message = sender.messages[0];
    expect(message?.tags).toEqual([
      { name: "type", value: "inquiry" },
      { name: "category", value: "OTHER" },
    ]);
  });
});
