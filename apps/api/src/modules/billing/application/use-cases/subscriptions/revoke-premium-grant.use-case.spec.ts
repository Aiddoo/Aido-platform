import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createSubscriptionFixture } from "#test/fixtures/subscription.fixture";
import { StubPremiumGrantRepository } from "#test/mocks/ports/subscription.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { RevokePremiumGrant } from "./revoke-premium-grant.use-case.js";

const AT = new Date("2028-02-26T09:00:00.000Z");

function given() {
  const fixture = createSubscriptionFixture();
  const premiumGrantRepository = new StubPremiumGrantRepository();
  const invalidated: string[] = [];
  const projected: string[] = [];
  const logger = mock<ApplicationLogger>();
  const useCase = new RevokePremiumGrant({
    premiumGrantRepository,
    premiumAccessProjector: {
      project: async ({ userId }) => {
        projected.push(userId);
        return {
          access: {
            source: null,
            endsAt: null,
            periodEndsAt: null,
            willRenew: false,
            bankedDays: 0,
            recentGrantEndedAt: null,
            isTrial: false,
          },
          userState: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          changedGrantCount: 0,
        };
      },
    },
    userMutationLock: { lockById: async () => true },
    unitOfWork: createUnitOfWorkMock(),
    cache: {
      invalidate: async (userId) => {
        invalidated.push(userId);
      },
    },
    logger,
  });
  const userId = fixture.user.id;
  premiumGrantRepository.grants.set("grant-1", {
    id: "grant-1",
    userId,
    source: "INVITE",
    sourceKey: "invite:wrong",
    durationDays: 7,
    durationMs: null,
    status: "ACTIVE",
    startsAt: new Date("2028-02-25T09:00:00.000Z"),
    endsAt: new Date("2028-03-03T09:00:00.000Z"),
    endingNotifiedAt: null,
    createdAt: new Date("2028-02-20T00:00:00.000Z"),
  });
  premiumGrantRepository.grants.set("grant-2", {
    id: "grant-2",
    userId,
    source: "INVITE",
    sourceKey: "rebank:grant-1",
    durationDays: 3,
    durationMs: null,
    status: "BANKED",
    startsAt: null,
    endsAt: null,
    endingNotifiedAt: null,
    createdAt: new Date("2028-02-20T00:00:00.000Z"),
  });
  return { useCase, premiumGrantRepository, invalidated, projected, logger, userId };
}

describe("RevokePremiumGrant — 보상 기간 취소", () => {
  it("기간과 다시 쌓아 둔 남은 기간을 함께 취소하고 다시 계산한 뒤 캐시를 비운다", async () => {
    // Given
    const { useCase, premiumGrantRepository, invalidated, projected, userId } = given();

    // When
    const result = await useCase.execute({ sourceKey: "invite:wrong", now: AT });

    // Then
    expect(result).toEqual({ status: "revoked", userId, revokedGrantCount: 2 });
    expect(premiumGrantRepository.grants.get("grant-1")).toMatchObject({
      status: "REVOKED",
      endsAt: AT,
    });
    expect(premiumGrantRepository.grants.get("grant-2")?.status).toBe("REVOKED");
    expect(projected).toEqual([userId]);
    expect(invalidated).toEqual([userId]);
  });

  it("같은 취소를 다시 보내면 바꾸지 않고 다시 계산·캐시 정리도 하지 않는다", async () => {
    // Given
    const { useCase, projected, invalidated } = given();
    await useCase.execute({ sourceKey: "invite:wrong", now: AT });

    // When
    const result = await useCase.execute({ sourceKey: "invite:wrong", now: AT });

    // Then
    expect(result).toEqual({ status: "unchanged" });
    expect(projected).toHaveLength(1);
    expect(invalidated).toHaveLength(1);
  });

  it("없는 출처 키는 not-found다", async () => {
    // Given
    const { useCase } = given();

    // When
    const result = await useCase.execute({ sourceKey: "invite:missing", now: AT });

    // Then
    expect(result).toEqual({ status: "not-found" });
  });
});
