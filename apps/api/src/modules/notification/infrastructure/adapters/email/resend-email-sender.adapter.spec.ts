import { Logger } from "@nestjs/common";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { EmailMessage } from "#api/modules/notification/domain/value-objects/email/email-message.vo";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import { ResendEmailSenderAdapter } from "./resend-email-sender.adapter.js";

const resend = vi.hoisted(() => ({ emails: { send: vi.fn() } }));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return resend;
  }),
}));

describe("Resend Email Adapter — 발송 계약과 인증 정보 비노출", () => {
  const recipient = "private@example.com";
  const verificationCode = "987654";
  const message = () =>
    EmailMessage.verificationCode(recipient, { code: verificationCode, expiryMinutes: 15 });

  function adapter(isConfigured: boolean): ResendEmailSenderAdapter {
    return new ResendEmailSenderAdapter(
      mock<TypedConfigService>({
        nodeEnv: "test",
        email: {
          isConfigured,
          apiKey: isConfigured ? "test-key" : undefined,
          from: "noreply@example.com",
          fromName: "Aido",
          supportEmail: "support@example.com",
        },
      }),
    );
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  it("API key가 없으면 발송을 모의 처리하되 이메일 주소와 인증 코드를 기록하지 않는다", async () => {
    // Given
    const sender = adapter(false);

    // When
    const result = await sender.send(message());

    // Then
    expect(result).toEqual({
      success: true,
      messageId: expect.stringMatching(/^mock-/),
      retryCount: 0,
    });
    expect(resend.emails.send).not.toHaveBeenCalled();
    expect(Logger.prototype.debug).toHaveBeenCalledWith({
      event: EmailLogEvent.DELIVERY_SIMULATED,
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.debug).mock.calls)).not.toContain(recipient);
    expect(JSON.stringify(vi.mocked(Logger.prototype.debug).mock.calls)).not.toContain(
      verificationCode,
    );
  });

  it("공급자 성공 응답의 messageId를 유지하고 로그에는 수신자 대신 식별자를 기록한다", async () => {
    // Given
    resend.emails.send.mockResolvedValue({ data: { id: "message-1" }, error: null });
    const sender = adapter(true);

    // When
    const result = await sender.send(message());

    // Then
    expect(result).toEqual({ success: true, messageId: "message-1", retryCount: 0 });
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: recipient, text: expect.stringContaining(verificationCode) }),
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith({
      event: EmailLogEvent.DELIVERY_COMPLETED,
      messageId: "message-1",
      retryCount: 0,
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.log).mock.calls)).not.toContain(recipient);
  });

  it("실패 결과는 그대로 반환하고 수신자나 공급자 오류 원문을 로그에 기록하지 않는다", async () => {
    // Given
    const errorMessage = `Rejected ${recipient}: ${verificationCode}`;
    resend.emails.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: errorMessage },
    });
    const sender = adapter(true);

    // When
    const result = await sender.send(message());

    // Then
    expect(result).toEqual({ success: false, error: errorMessage, retryCount: 0 });
    expect(Logger.prototype.error).toHaveBeenCalledWith({
      event: EmailLogEvent.DELIVERY_FAILED,
      errorType: "validation_error",
      retryCount: 0,
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.error).mock.calls)).not.toContain(
      errorMessage,
    );
  });
});
