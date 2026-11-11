import { FakeBillingUserLock } from "#test/doubles/billing/fake-billing-user-lock";
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
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import { bankedRemainderSourceKey } from "../../domain/premium-grant.aggregate.js";
import { LoadPremiumEntitlementsUseCase } from "./load-premium-entitlements.use-case.js";
import { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";
import { RevokePremiumGrantUseCase } from "./revoke-premium-grant.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY = 24 * 60 * 60 * 1000;

function setup(grants: PremiumGrant[]) {
  const premiumGrantRepository = new InMemoryPremiumGrantRepository(grants);
  const projection = new InMemoryUserSubscriptionProjectionRepository([
    SUBSCRIPTION_FIXTURE_USER_ID,
  ]);
  const cache = new RecordingPremiumAccessCache();
  const loadPremiumEntitlements = new LoadPremiumEntitlementsUseCase({
    storeEntitlementReader: new InMemoryStoreEntitlementReader(
      new InMemorySubscriptionRepository(),
    ),
    premiumGrantRepository,
  });
  const useCase = new RevokePremiumGrantUseCase({
    premiumGrantRepository,
    projectPremiumAccess: new ProjectPremiumAccessUseCase({
      loadPremiumEntitlements,
      premiumGrantRepository,
      userSubscriptionProjection: projection,
    }),
    userLock: new FakeBillingUserLock([SUBSCRIPTION_FIXTURE_USER_ID]),
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    logger: new SilentLogger(),
  });
  return { useCase, premiumGrantRepository, projection, cache };
}

describe("RevokePremiumGrantUseCase — 보상 기간 취소", () => {
  it("진행 중인 기간을 지금 끝내 REVOKED로 남기고 프리미엄을 끝낸다", async () => {
    // Given
    const grant = createPremiumGrantFixture({ sourceKey: "invite:wrong" });
    const { useCase, premiumGrantRepository, projection, cache } = setup([grant]);
    const at = NOW.add({ milliseconds: DAY });

    // When
    const result = await useCase.execute({ sourceKey: "invite:wrong", now: at });

    // Then
    expect(result).toEqual({
      status: "revoked",
      userId: SUBSCRIPTION_FIXTURE_USER_ID,
      revokedGrantCount: 1,
    });
    expect(premiumGrantRepository.all[0]?.toPrimitives()).toMatchObject({
      status: "REVOKED",
      endsAt: at,
    });
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(cache.invalidatedUserIds).toEqual([SUBSCRIPTION_FIXTURE_USER_ID]);
  });

  it("진행 중에 끊어 다시 쌓아 둔 남은 기간도 함께 취소한다", async () => {
    // Given
    const grant = createPremiumGrantFixture({ id: "grant-cut", sourceKey: "invite:cut" });
    const remainder = createBankedPremiumGrantFixture({
      id: "grant-remainder",
      sourceKey: bankedRemainderSourceKey(grant.id),
    });
    const { useCase, premiumGrantRepository } = setup([grant, remainder]);

    // When
    const result = await useCase.execute({
      sourceKey: "invite:cut",
      now: NOW.add({ milliseconds: DAY }),
    });

    // Then
    expect(result).toMatchObject({ status: "revoked", revokedGrantCount: 2 });
    expect(premiumGrantRepository.all.map((stored) => stored.status)).toEqual([
      "REVOKED",
      "REVOKED",
    ]);
  });

  it("같은 취소를 다시 보내면 바꾸지 않고 unchanged다", async () => {
    // Given
    const { useCase } = setup([createPremiumGrantFixture({ sourceKey: "invite:wrong" })]);
    const command = { sourceKey: "invite:wrong", now: NOW.add({ milliseconds: DAY }) };
    await useCase.execute(command);

    // When
    const second = await useCase.execute(command);

    // Then
    expect(second).toEqual({ status: "unchanged" });
  });

  it("출처 키가 없으면 not-found다", async () => {
    // Given
    const { useCase } = setup([]);

    // When
    const result = await useCase.execute({ sourceKey: "invite:none", now: NOW });

    // Then
    expect(result).toEqual({ status: "not-found" });
  });
});
