import {
  RecordingEmailBudget,
  RecordingEmailDeliveryQueue,
} from "#test/doubles/notification/recording-email-delivery";
import { StubEmailTemplateRenderer } from "#test/doubles/notification/stub-email-template-renderer";

import type { EmailMessage } from "../../domain/email-message.aggregate.js";
import { QueueEmailMessageUseCase } from "./queue-email-message.use-case.js";
import { SendCodeEmailUseCase } from "./send-code-email.use-case.js";

const noopLogger = { log: () => undefined, warn: () => undefined };
const data = { code: "123456", expiryMinutes: 10 };

describe("SendCodeEmailUseCase — 코드 메일 발송 요청", () => {
  let queue: RecordingEmailDeliveryQueue;
  let budget: RecordingEmailBudget;
  let renderer: StubEmailTemplateRenderer;
  let sendCodeEmail: SendCodeEmailUseCase;

  beforeEach(() => {
    queue = new RecordingEmailDeliveryQueue();
    budget = new RecordingEmailBudget();
    renderer = new StubEmailTemplateRenderer();
    sendCodeEmail = new SendCodeEmailUseCase({
      renderer,
      queueEmailMessage: new QueueEmailMessageUseCase({ queue, budget, logger: noopLogger }),
    });
  });

  function queuedMessage(): EmailMessage {
    const delivery = queue.deliveries[0];
    if (delivery == null) {
      throw new Error("큐에 담긴 발송 건이 없습니다");
    }
    return delivery.message;
  }

  it("인증 메시지를 받는 사람 언어로 렌더해 큐에 담고 critical 예산을 예약한다", async () => {
    // When
    const result = await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "verification",
      templateData: data,
      locale: "en",
    });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(queue.deliveries).toEqual([
      { deliveryId: expect.any(String), message: queuedMessage() },
    ]);
    expect(renderer.requests).toEqual([{ template: { kind: "verification", data }, locale: "en" }]);
    expect(queuedMessage().subject).toBe("[verification]");
    expect(queuedMessage().tags).toEqual([{ name: "type", value: "verification" }]);
    expect(budget.reserved).toEqual(["critical"]);
  });

  it("코드 메일은 발송 건마다 새 deliveryId를 만든다", async () => {
    // When
    await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "password-reset",
      templateData: data,
      locale: "ko",
    });
    await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "password-setup",
      templateData: data,
      locale: "ko",
    });

    // Then
    const [first, second] = queue.deliveries;
    expect(first?.deliveryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second?.deliveryId).not.toBe(first?.deliveryId);
    expect(budget.reserved).toEqual(["critical", "critical"]);
  });

  it("예산이 없으면 큐에 담지 않고 budget_exhausted로 거절한다", async () => {
    // Given
    budget.reservation = "exhausted";

    // When
    const result = await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "verification",
      templateData: data,
      locale: "ko",
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
    const result = await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "verification",
      templateData: data,
      locale: "ko",
    });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "queue_unavailable" });
    expect(budget.releases).toBe(1);
  });

  it("이미 큐에 있는 발송 건이면 queued로 응답하되 예약을 돌려준다", async () => {
    // Given
    queue.result = "duplicate";

    // When
    const result = await sendCodeEmail.execute({
      to: "user@test.com",
      kind: "verification",
      templateData: data,
      locale: "ko",
    });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(budget.releases).toBe(1);
  });
});
