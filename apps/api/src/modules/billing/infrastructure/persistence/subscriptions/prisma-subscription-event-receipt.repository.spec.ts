import { createMockTransactionHost, databaseWriteExpectation } from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaSubscriptionEventReceiptRepository } from "./prisma-subscription-event-receipt.repository.js";

const at = new Date("2027-01-04T12:00:00.000Z");

describe("SubscriptionEventReceiptRepository — 성공 처리 이벤트의 조건부 기록", () => {
  let db: MockDatabaseContext;
  let repository: PrismaSubscriptionEventReceiptRepository;

  beforeEach(() => {
    db = createMockDatabaseContext();
    repository = new PrismaSubscriptionEventReceiptRepository(createMockTransactionHost(db));
  });

  it.each([
    { inserted: 0, claimed: false },
    { inserted: 1, claimed: true },
  ])("INSERT $inserted행이면 claim 결과는 $claimed이다", async ({ inserted, claimed }) => {
    // Given
    db.orm.public.SubscriptionEventReceipt.createAndCount.mockResolvedValue(inserted);

    // When
    const result = await repository.claim({
      eventId: "event-1",
      eventType: "RENEWAL",
      processedAt: at,
    });

    // Then
    expect(result).toBe(claimed);
    expect(db.orm.public.SubscriptionEventReceipt.createAndCount).toHaveBeenCalledWith(
      [
        databaseWriteExpectation("SubscriptionEventReceipt", {
          provider: "REVENUECAT",
          eventId: "event-1",
          eventType: "RENEWAL",
          processedAt: at,
        }),
      ],
      { onConflict: "skip", conflictOn: ["provider", "eventId"] },
    );
  });
});
