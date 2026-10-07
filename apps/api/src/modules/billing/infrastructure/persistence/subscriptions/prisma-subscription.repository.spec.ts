import { ErrorCode } from "@aido/api/errors";

import { varchar } from "#api/platform/database/database-values";
import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaSubscriptionRepository } from "./prisma-subscription.repository.js";

const at = new Date("2027-01-04T12:00:00.000Z");

describe("SubscriptionRepository — 구독·사용자 부분 갱신과 부재 처리", () => {
  let db: MockDatabaseContext;
  let repository: PrismaSubscriptionRepository;

  beforeEach(() => {
    db = createMockDatabaseContext();
    repository = new PrismaSubscriptionRepository(createMockTransactionHost(db));
  });

  it("단일 조건부 UPDATE로 구독의 nullable 취소·이벤트 필드를 저장한다", async () => {
    // Given
    db.orm.public.Subscription.updateAndCount.mockResolvedValue(1);
    const state = {
      status: "ACTIVE",
      cancelledAt: null,
      lastProcessedEventId: null,
      expiresAt: at,
    } satisfies Parameters<PrismaSubscriptionRepository["updateStatus"]>[1];

    // When
    await repository.updateStatus("chain-1", state);

    // Then
    assertNativeWhere("Subscription", db.orm.public.Subscription.where.mock.calls[0]?.[0], (row) =>
      row.revenueCatId.eq(varchar("chain-1", 255)),
    );
    expect(db.orm.public.Subscription.updateAndCount).toHaveBeenCalledWith(
      databaseWriteExpectation("Subscription", state),
    );
  });

  it("대상 구독이 없으면 기존 SUBSCRIPTION_1604와 reason을 반환한다", async () => {
    // Given
    db.orm.public.Subscription.updateAndCount.mockResolvedValue(0);

    // When / Then
    await expect(
      repository.updateStatus("missing-chain", { status: "EXPIRED" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.SUBSCRIPTION_1604,
      details: { reason: "Subscription not found: missing-chain" },
    });
  });

  it("사용자 필드의 undefined는 생략하고 null 만료일은 명시적으로 지운다", async () => {
    // Given
    db.orm.public.User.updateAndCount.mockResolvedValue(1);

    // When
    await repository.updateUserSubscriptionStatus("user-1", {
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
      revenueCatUserId: undefined,
    });

    // Then
    expect(db.orm.public.User.updateAndCount).toHaveBeenCalledWith(
      databaseWriteExpectation("User", { subscriptionStatus: "FREE", subscriptionExpiresAt: null }),
    );
  });

  it("사용자가 사라졌으면 기존 저장소 부재 오류를 반환한다", async () => {
    // Given
    db.orm.public.User.updateAndCount.mockResolvedValue(0);

    // When / Then
    await expect(
      repository.updateUserSubscriptionStatus("missing-user", { subscriptionStatus: "FREE" }),
    ).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });
});
