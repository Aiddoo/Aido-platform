import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { createEmailMessageFixture } from "#test/fixtures/notification/email-message.fixture";

import type { EmailDeliveryOutcome, EmailQuotaScope } from "../ports/email-sender.port.js";
import { DeliverEmailUseCase, EmailDeliveryRetryableError } from "./deliver-email.use-case.js";

class StubSender {
  sent = 0;

  readonly #outcome: EmailDeliveryOutcome;

  constructor(outcome: EmailDeliveryOutcome) {
    this.#outcome = outcome;
  }

  async send(): Promise<EmailDeliveryOutcome> {
    this.sent += 1;
    return this.#outcome;
  }
}

class StubBudget {
  releases = 0;
  settled: EmailQuotaScope[] = [];

  async release(): Promise<void> {
    this.releases += 1;
  }

  async settleProviderQuotaExhausted(scope: EmailQuotaScope): Promise<void> {
    this.settled.push(scope);
  }
}

const logger = { log: () => undefined, warn: () => undefined };
const message = createEmailMessageFixture();

function setup(outcome: EmailDeliveryOutcome) {
  const sender = new StubSender(outcome);
  const budget = new StubBudget();
  const alert = new RecordingOperationalAlert();
  const useCase = new DeliverEmailUseCase({ sender, budget, alert, logger });
  return { useCase, sender, budget, alert };
}

describe("DeliverEmailUseCase", () => {
  it("보내졌으면 예산을 그대로 두고 경보도 올리지 않는다", async () => {
    // Given
    const { useCase, budget, alert } = setup({ status: "sent", providerMessageId: "id" });

    // When
    await useCase.execute({ deliveryId: "d1", message, isFinalAttempt: false });

    // Then
    expect(budget.releases).toBe(0);
    expect(alert.alerts).toEqual([]);
  });

  it.each([["rate_limited"], ["unavailable"]] as const)(
    "재시도할 수 있는 %s 실패는 예산을 두고 던져서 큐가 다시 시도하게 한다",
    async (reason) => {
      // Given
      const { useCase, budget, alert } = setup({ status: "failed", reason, retryable: true });

      // When
      const execution = useCase.execute({ deliveryId: "d1", message, isFinalAttempt: false });

      // Then
      await expect(execution).rejects.toBeInstanceOf(EmailDeliveryRetryableError);
      expect(budget.releases).toBe(0);
      expect(alert.alerts).toEqual([]);
    },
  );

  it("마지막 시도까지 재시도 가능 실패면 던지지 않고 예산을 돌려주고 경보를 올린다", async () => {
    // Given
    const { useCase, budget, alert } = setup({
      status: "failed",
      reason: "unavailable",
      retryable: true,
    });

    // When
    await useCase.execute({ deliveryId: "d1", message, isFinalAttempt: true });

    // Then
    expect(budget.releases).toBe(1);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "notification.email.delivery-retry-exhausted",
        tags: { kind: "verification", reason: "unavailable" },
      }),
    ]);
  });

  it.each(["rejected", "not_configured"] as const)(
    "재시도 불가 %s 거절은 던지지 않고 예산을 돌려주고 경보를 올린다",
    async (reason) => {
      // Given
      const { useCase, budget, alert } = setup({ status: "failed", reason, retryable: false });

      // When
      await useCase.execute({ deliveryId: "d1", message, isFinalAttempt: false });

      // Then
      expect(budget.releases).toBe(1);
      expect(alert.alerts).toEqual([
        expect.objectContaining({ key: "notification.email.delivery-rejected" }),
      ]);
    },
  );

  it.each(["daily", "monthly"] as const)(
    "공급자 %s 한도 초과는 예산을 돌려주지 않고 계량을 한도까지 맞추며 재시도하지 않는다",
    async (scope) => {
      // Given
      const { useCase, budget, alert } = setup({
        status: "failed",
        reason: "quota_exhausted",
        retryable: false,
        scope,
      });

      // When
      await useCase.execute({ deliveryId: "d1", message, isFinalAttempt: false });

      // Then
      expect(budget.settled).toEqual([scope]);
      expect(budget.releases).toBe(0);
      expect(alert.alerts).toEqual([]);
    },
  );
});
