import {
  RecordingEmailBudget,
  RecordingEmailSender,
} from "#test/doubles/notification/recording-email-delivery";
import { StubEmailTemplateRenderer } from "#test/doubles/notification/stub-email-template-renderer";

import { SendInquiryEmailUseCase } from "./send-inquiry-email.use-case.js";

const data = {
  userEmail: "user@test.com",
  category: "OTHER",
  categoryLabel: "기타",
  content: "내용",
  submittedAt: "2026-03-09 10:00",
} as const;

describe("SendInquiryEmailUseCase — 문의는 요청 안에서 한 번 보낸다", () => {
  let budget: RecordingEmailBudget;
  let sender: RecordingEmailSender;
  let renderer: StubEmailTemplateRenderer;
  let sendInquiryEmail: SendInquiryEmailUseCase;

  beforeEach(() => {
    budget = new RecordingEmailBudget();
    sender = new RecordingEmailSender();
    renderer = new StubEmailTemplateRenderer();
    sendInquiryEmail = new SendInquiryEmailUseCase({
      sender,
      budget,
      renderer,
      logger: { warn: () => undefined },
    });
  });

  it("운영자 언어(ko)로 렌더하고 standard 예산을 예약해 큐 없이 바로 보내 sent로 답한다", async () => {
    // When
    const result = await sendInquiryEmail.execute({ to: "support@test.com", templateData: data });

    // Then
    expect(result).toEqual({ status: "sent" });
    expect(renderer.requests).toEqual([{ template: { kind: "inquiry", data }, locale: "ko" }]);
    expect(budget.reserved).toEqual(["standard"]);
    expect(sender.messages[0]?.tags).toEqual([
      { name: "type", value: "inquiry" },
      { name: "category", value: "OTHER" },
    ]);
  });

  it("예산이 없으면 보내지 않고 거절한다", async () => {
    // Given
    budget.reservation = "exhausted";

    // When
    const result = await sendInquiryEmail.execute({ to: "support@test.com", templateData: data });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "budget_exhausted" });
    expect(sender.messages).toEqual([]);
  });

  it("일시 장애도 재시도 없이 한 번만 시도하고 예약을 돌려주며 거절해 사용자가 다시 보내게 한다", async () => {
    // Given
    sender.outcome = { status: "failed", reason: "unavailable", retryable: true };

    // When
    const result = await sendInquiryEmail.execute({ to: "support@test.com", templateData: data });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
    expect(sender.messages).toHaveLength(1);
    expect(budget.releases).toBe(1);
  });

  it("공급자 한도 초과면 예약을 돌려주지 않고 계량을 한도에 맞춘 뒤 거절한다", async () => {
    // Given
    sender.outcome = {
      status: "failed",
      reason: "quota_exhausted",
      retryable: false,
      scope: "daily",
    };

    // When
    const result = await sendInquiryEmail.execute({ to: "support@test.com", templateData: data });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
    expect(budget.settled).toEqual(["daily"]);
    expect(budget.releases).toBe(0);
  });
});
