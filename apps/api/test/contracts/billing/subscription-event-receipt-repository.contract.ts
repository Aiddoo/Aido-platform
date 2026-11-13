import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

import type { SubscriptionEventReceiptRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-receipt.repository.port";
import { ProviderEventId } from "#api/modules/billing/subscriptions/domain/provider-event-id.vo";
import { SubscriptionEventReceipt } from "#api/modules/billing/subscriptions/domain/subscription-event-receipt.entity";
import { SUBSCRIPTION_FIXTURE_NOW } from "#test/fixtures/billing/subscription.fixture";

function receipt(
  eventId: string,
  overrides: { readonly eventType?: string; readonly environment?: SubscriptionEnvironment } = {},
) {
  return SubscriptionEventReceipt.create({
    provider: "REVENUECAT",
    eventId: ProviderEventId.reconstitute(eventId),
    eventType: "INITIAL_PURCHASE",
    environment: null,
    now: SUBSCRIPTION_FIXTURE_NOW,
    ...overrides,
  });
}

export function describeSubscriptionEventReceiptRepositoryContract(
  createRepository: () => Promise<SubscriptionEventReceiptRepositoryPort>,
): void {
  describe("구독 이벤트 처리 기록 저장소 계약", () => {
    it("처음 보는 이벤트는 기록하고 true를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const claimed = await repository.claim(receipt("event-1"));

      // Then
      expect(claimed).toBe(true);
    });

    it("이미 기록한 이벤트를 다시 claim하면 false다", async () => {
      // Given
      const repository = await createRepository();
      await repository.claim(receipt("event-1"));

      // When
      const claimedAgain = await repository.claim(receipt("event-1"));

      // Then
      expect(claimedAgain).toBe(false);
    });

    it("다른 eventType으로 다시 와도 같은 eventId면 중복이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.claim(receipt("event-1"));

      // When
      const claimedAgain = await repository.claim(receipt("event-1", { eventType: "RENEWAL" }));

      // Then
      expect(claimedAgain).toBe(false);
    });

    it("eventId가 다르면 각각 기록한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const first = await repository.claim(receipt("event-1"));
      const second = await repository.claim(receipt("event-2"));

      // Then
      expect([first, second]).toEqual([true, true]);
    });

    it("환경은 null이거나 값이 있어도 기록한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const results = [
        await repository.claim(receipt("event-null")),
        await repository.claim(receipt("event-sandbox", { environment: "SANDBOX" })),
      ];

      // Then
      expect(results).toEqual([true, true]);
    });
  });
}
