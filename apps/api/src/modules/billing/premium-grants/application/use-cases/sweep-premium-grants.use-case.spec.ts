import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeUserMutationLock } from "#test/doubles/billing/fake-user-mutation-lock";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemoryStoreEntitlementReader } from "#test/doubles/billing/in-memory-store-entitlement.reader";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryUserSubscriptionProjectionRepository } from "#test/doubles/billing/in-memory-user-subscription-projection.repository";
import { RecordingPremiumAccessCache } from "#test/doubles/billing/recording-premium-access-cache";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createBankedPremiumGrantFixture,
  createPremiumGrantFixture,
} from "#test/fixtures/billing/premium-grant.fixture";
import {
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import { LoadPremiumEntitlementsUseCase } from "./load-premium-entitlements.use-case.js";
import { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";
import { SweepPremiumGrantsUseCase } from "./sweep-premium-grants.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY = 24 * 60 * 60 * 1000;
const LATER = NOW.add({ milliseconds: 8 * DAY });

function setup(grants: PremiumGrant[], knownUserIds = [SUBSCRIPTION_FIXTURE_USER_ID]) {
  const premiumGrantRepository = new InMemoryPremiumGrantRepository(grants);
  const projection = new InMemoryUserSubscriptionProjectionRepository(knownUserIds);
  const cache = new RecordingPremiumAccessCache();
  const loadPremiumEntitlements = new LoadPremiumEntitlementsUseCase({
    storeEntitlementReader: new InMemoryStoreEntitlementReader(
      new InMemorySubscriptionRepository(),
    ),
    premiumGrantRepository,
  });
  const useCase = new SweepPremiumGrantsUseCase({
    premiumGrantRepository,
    userSubscriptionProjection: projection,
    projectPremiumAccess: new ProjectPremiumAccessUseCase({
      loadPremiumEntitlements,
      premiumGrantRepository,
      userSubscriptionProjection: projection,
    }),
    userLock: new FakeUserMutationLock(knownUserIds),
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    logger: new SilentLogger(),
  });
  return { useCase, premiumGrantRepository, projection, cache };
}

describe("SweepPremiumGrantsUseCase — 보상 기간 정리", () => {
  it("끝난 기간을 닫고 쌓아 둔 기간을 이어서 시작한다", async () => {
    // Given
    const ended = createPremiumGrantFixture({ id: "grant-ended", sourceKey: "invite:ended" });
    const banked = createBankedPremiumGrantFixture({
      id: "grant-next",
      sourceKey: "invite:next",
      createdAt: NOW.add({ minutes: 1 }),
    });
    const { useCase, premiumGrantRepository, projection, cache } = setup([ended, banked]);

    // When
    const result = await useCase.execute({ now: LATER });

    // Then
    expect(result).toMatchObject({ userCount: 1, changedGrantCount: 2, failedUserCount: 0 });
    expect(
      premiumGrantRepository.all.map((grant) => [grant.sourceKey, grant.status, grant.endsAt]),
    ).toEqual([
      ["invite:ended", "ENDED", NOW.add({ milliseconds: 7 * DAY })],
      ["invite:next", "ACTIVE", NOW.add({ milliseconds: 14 * DAY })],
    ]);
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toMatchObject({
      subscriptionStatus: "ACTIVE",
    });
    expect(cache.invalidatedUserIds).toEqual([SUBSCRIPTION_FIXTURE_USER_ID]);
  });

  it("만료 웹훅을 잃은 사용자도 같은 계산으로 다시 정리해 FREE로 저장한다", async () => {
    // Given
    const { useCase, projection } = setup([]);
    await projection.update(UserId.reconstitute(SUBSCRIPTION_FIXTURE_USER_ID), {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: NOW,
    });

    // When
    const result = await useCase.execute({ now: LATER });

    // Then
    expect(result).toMatchObject({ lapsedUserCount: 1, lapsedFailedUserCount: 0 });
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
  });

  it("한 사용자의 실패가 나머지를 막지 않고 실패 수만 센다", async () => {
    // Given
    const { useCase, premiumGrantRepository, projection } = setup(
      [
        createPremiumGrantFixture({ id: "grant-a", sourceKey: "invite:a" }),
        createPremiumGrantFixture({
          id: "grant-b",
          sourceKey: "invite:b",
          userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        }),
      ],
      [SUBSCRIPTION_FIXTURE_USER_ID, SUBSCRIPTION_FIXTURE_OTHER_USER_ID],
    );
    const update = projection.update.bind(projection);
    vi.spyOn(projection, "update").mockImplementationOnce(async () => {
      throw new Error("deadlock");
    });
    vi.spyOn(projection, "update").mockImplementation(update);

    // When
    const result = await useCase.execute({ now: LATER });

    // Then
    expect(result).toMatchObject({ userCount: 2, failedUserCount: 1 });
    expect(premiumGrantRepository.all.filter((grant) => grant.status === "ENDED")).toHaveLength(2);
  });

  it("정리할 것이 없으면 아무 사용자도 건드리지 않는다", async () => {
    // Given
    const { useCase } = setup([createPremiumGrantFixture()]);

    // When
    const result = await useCase.execute({ now: NOW.add({ milliseconds: DAY }) });

    // Then
    expect(result).toMatchObject({ userCount: 0, changedGrantCount: 0, hasRemaining: false });
  });
});
