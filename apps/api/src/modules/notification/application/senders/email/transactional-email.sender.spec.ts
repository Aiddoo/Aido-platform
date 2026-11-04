import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import type { EmailBudgetReservation } from "../../ports/email/email-budget.port.js";
import type {
  EmailDelivery,
  EmailDeliveryQueuePort,
} from "../../ports/email/email-delivery-queue.port.js";
import { TransactionalEmailSender } from "./transactional-email.sender.js";

class StubQueue implements EmailDeliveryQueuePort {
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

class StubBudget {
  readonly reserved: string[] = [];
  releases = 0;
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

describe("TransactionalEmailSender — 트랜잭션 이메일 발송 요청", () => {
  let queue: StubQueue;
  let budget: StubBudget;
  let emailSender: TransactionalEmailSender;

  beforeEach(() => {
    queue = new StubQueue();
    budget = new StubBudget();
    emailSender = new TransactionalEmailSender({ queue, budget, logger: noopLogger });
  });

  function queuedMessage(): EmailMessage {
    const delivery = queue.deliveries[0];
    if (delivery == null) {
      throw new Error("큐에 담긴 발송 건이 없습니다");
    }
    return delivery.message;
  }

  it("인증 메시지를 조립해 큐에 담고 critical 예산을 예약한다", async () => {
    // Given
    const data = { code: "123456", expiryMinutes: 10 };

    // When
    const result = await emailSender.sendVerificationCode("user@test.com", data, "idem-1");

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(queue.deliveries).toEqual([{ deliveryId: "idem-1", message: queuedMessage() }]);
    expect(queuedMessage().subject).toBe("[아이두] 이메일 인증 코드");
    expect(queuedMessage().tags).toEqual([{ name: "type", value: "verification" }]);
    expect(budget.reserved).toEqual(["critical"]);
  });

  it("멱등 키가 없으면 발송 건마다 새 deliveryId를 만든다", async () => {
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

  it("문의는 standard 예산으로 큐에 담는다", async () => {
    // When
    const result = await emailSender.sendInquiry("support@test.com", {
      userEmail: "user@test.com",
      category: "OTHER",
      categoryLabel: "기타",
      content: "내용",
      submittedAt: "2026-03-09 10:00",
    });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(budget.reserved).toEqual(["standard"]);
    expect(queuedMessage().tags).toEqual([
      { name: "type", value: "inquiry" },
      { name: "category", value: "OTHER" },
    ]);
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
    const result = await emailSender.sendVerificationCode(
      "user@test.com",
      { code: "123456", expiryMinutes: 10 },
      "idem-1",
    );

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(budget.releases).toBe(1);
  });
});
