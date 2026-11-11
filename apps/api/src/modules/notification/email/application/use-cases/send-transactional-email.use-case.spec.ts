import { StubEmailTemplateRenderer } from "#test/doubles/notification/stub-email-template-renderer";

import type { EmailMessage } from "../../domain/email-message.vo.js";
import type { EmailBudgetReservation } from "../ports/email-budget.port.js";
import { type EmailDelivery, EmailDeliveryQueuePort } from "../ports/email-delivery-queue.port.js";
import type { EmailDeliveryOutcome, EmailQuotaScope } from "../ports/email-sender.port.js";
import { SendTransactionalEmailUseCase } from "./send-transactional-email.use-case.js";

class StubQueue extends EmailDeliveryQueuePort {
  readonly deliveries: EmailDelivery[] = [];
  failure: Error | null = null;
  result: "queued" | "duplicate" = "queued";

  async enqueue(delivery: EmailDelivery): Promise<"queued" | "duplicate"> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.deliveries.push(delivery);
    return this.result;
  }
}

class StubSender {
  readonly messages: EmailMessage[] = [];
  outcome: EmailDeliveryOutcome = { status: "sent", providerMessageId: "id-1" };

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    this.messages.push(message);
    return this.outcome;
  }
}

class StubBudget {
  readonly reserved: string[] = [];
  readonly settled: EmailQuotaScope[] = [];
  releases = 0;

  async settleProviderQuotaExhausted(scope: EmailQuotaScope): Promise<void> {
    this.settled.push(scope);
  }
  reservation: EmailBudgetReservation = "reserved";

  async reserve(priority: string): Promise<EmailBudgetReservation> {
    this.reserved.push(priority);
    return this.reservation;
  }

  async release(): Promise<void> {
    this.releases += 1;
  }
}

const noopLogger = { log: () => undefined, warn: () => undefined };

describe("SendTransactionalEmailUseCase — 트랜잭션 이메일 발송 요청", () => {
  let queue: StubQueue;
  let budget: StubBudget;
  let sender: StubSender;
  let renderer: StubEmailTemplateRenderer;
  let emailSender: SendTransactionalEmailUseCase;

  beforeEach(() => {
    queue = new StubQueue();
    budget = new StubBudget();
    sender = new StubSender();
    renderer = new StubEmailTemplateRenderer();
    emailSender = new SendTransactionalEmailUseCase({
      queue,
      sender,
      budget,
      renderer,
      logger: noopLogger,
    });
  });

  function queuedMessage(): EmailMessage {
    const delivery = queue.deliveries[0];
    if (delivery == null) {
      throw new Error("큐에 담긴 발송 건이 없습니다");
    }
    return delivery.message;
  }

  it("인증 메시지를 기본 언어로 렌더해 큐에 담고 critical 예산을 예약한다", async () => {
    // Given
    const data = { code: "123456", expiryMinutes: 10 };

    // When
    const result = await emailSender.sendVerificationCode("user@test.com", data);

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(queue.deliveries).toEqual([
      { deliveryId: expect.any(String), message: queuedMessage() },
    ]);
    expect(renderer.requests).toEqual([{ template: { kind: "verification", data }, locale: "ko" }]);
    expect(queuedMessage().subject).toBe("[verification]");
    expect(queuedMessage().tags).toEqual([{ name: "type", value: "verification" }]);
    expect(budget.reserved).toEqual(["critical"]);
  });

  it("인증 메일은 발송 건마다 새 deliveryId를 만든다", async () => {
    // Given
    const data = { code: "123456", expiryMinutes: 10 };

    // When
    await emailSender.sendPasswordResetCode("user@test.com", data);
    await emailSender.sendPasswordSetupCode("user@test.com", data);

    // Then
    const [first, second] = queue.deliveries;
    expect(first?.deliveryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second?.deliveryId).not.toBe(first?.deliveryId);
    expect(budget.reserved).toEqual(["critical", "critical"]);
  });

  describe("문의 — 요청 안에서 한 번 보낸다", () => {
    const data = {
      userEmail: "user@test.com",
      category: "OTHER",
      categoryLabel: "기타",
      content: "내용",
      submittedAt: "2026-03-09 10:00",
    } as const;

    it("standard 예산을 예약하고 큐 없이 바로 보내 sent로 답한다", async () => {
      // When
      const result = await emailSender.sendInquiry("support@test.com", data);

      // Then
      expect(result).toEqual({ status: "sent" });
      expect(budget.reserved).toEqual(["standard"]);
      expect(queue.deliveries).toEqual([]);
      expect(sender.messages[0]?.tags).toEqual([
        { name: "type", value: "inquiry" },
        { name: "category", value: "OTHER" },
      ]);
    });

    it("예산이 없으면 보내지 않고 거절한다", async () => {
      // Given
      budget.reservation = "exhausted";

      // When
      const result = await emailSender.sendInquiry("support@test.com", data);

      // Then
      expect(result).toEqual({ status: "rejected", reason: "budget_exhausted" });
      expect(sender.messages).toEqual([]);
    });

    it("일시 장애도 재시도 없이 한 번만 시도하고 예약을 돌려주며 거절해 사용자가 다시 보내게 한다", async () => {
      // Given
      sender.outcome = { status: "failed", reason: "unavailable", retryable: true };

      // When
      const result = await emailSender.sendInquiry("support@test.com", data);

      // Then
      expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
      expect(sender.messages).toHaveLength(1);
      expect(budget.releases).toBe(1);
      expect(queue.deliveries).toEqual([]);
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
      const result = await emailSender.sendInquiry("support@test.com", data);

      // Then
      expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
      expect(budget.settled).toEqual(["daily"]);
      expect(budget.releases).toBe(0);
    });
  });

  it("신고는 신고 ID를 deliveryId로 써서 같은 신고가 큐에 한 번만 담기게 한다", async () => {
    // When
    await emailSender.sendUserReport("support@test.com", {
      reportId: "report-1",
      reporterId: "u1",
      reporterTag: "A",
      targetUserId: "u2",
      targetUserTag: "B",
      targetType: "PROFILE",
      targetTypeLabel: "사용자",
      targetId: null,
      reason: "SPAM",
      reasonLabel: "스팸",
      detail: null,
      submittedAt: "2026-03-09 10:00",
      resolutionEndpoint: "POST /x",
      resolutionDocsUrl: null,
    });

    // Then
    expect(queue.deliveries[0]?.deliveryId).toBe("user-report:report-1");
    expect(budget.reserved).toEqual(["standard"]);
  });

  it("예산이 없으면 큐에 담지 않고 budget_exhausted로 거절한다", async () => {
    // Given
    budget.reservation = "exhausted";

    // When
    const result = await emailSender.sendVerificationCode("user@test.com", {
      code: "123456",
      expiryMinutes: 10,
    });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "budget_exhausted" });
    expect(queue.deliveries).toEqual([]);
    expect(budget.releases).toBe(0);
  });

  it("큐에 담지 못하면 예약을 돌려주고 queue_unavailable로 거절한다", async () => {
    // Given
    queue.failure = new Error("queue down");

    // When
    const result = await emailSender.sendVerificationCode("user@test.com", {
      code: "123456",
      expiryMinutes: 10,
    });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "queue_unavailable" });
    expect(budget.releases).toBe(1);
  });

  it("이미 큐에 있는 발송 건이면 queued로 응답하되 예약을 돌려준다", async () => {
    // Given
    queue.result = "duplicate";

    // When
    const result = await emailSender.sendVerificationCode("user@test.com", {
      code: "123456",
      expiryMinutes: 10,
    });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(budget.releases).toBe(1);
  });
});
