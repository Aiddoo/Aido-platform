import { ErrorCode } from "@aido/api/errors";

import type { Subscription } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeUserMutationLock } from "#test/doubles/billing/fake-user-mutation-lock";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemoryStoreEntitlementReader } from "#test/doubles/billing/in-memory-store-entitlement.reader";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryUserSubscriptionProjectionRepository } from "#test/doubles/billing/in-memory-user-subscription-projection.repository";
import { RecordingPremiumAccessCache } from "#test/doubles/billing/recording-premium-access-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPremiumGrantFixture } from "#test/fixtures/billing/premium-grant.fixture";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import { GetPremiumEntitlementsUseCase } from "./get-premium-entitlements.use-case.js";
import { GrantPremiumUseCase } from "./grant-premium.use-case.js";
import { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY = 24 * 60 * 60 * 1000;

function setup(
  options: {
    subscriptions?: Subscription[];
    grants?: PremiumGrant[];
    knownUserIds?: string[];
  } = {},
) {
  const knownUserIds = options.knownUserIds ?? [SUBSCRIPTION_FIXTURE_USER_ID];
  const subscriptionRepository = new InMemorySubscriptionRepository(options.subscriptions ?? []);
  const premiumGrantRepository = new InMemoryPremiumGrantRepository(options.grants ?? []);
  const projection = new InMemoryUserSubscriptionProjectionRepository(knownUserIds);
  const getPremiumEntitlements = new GetPremiumEntitlementsUseCase({
    storeEntitlementReader: new InMemoryStoreEntitlementReader(subscriptionRepository),
    premiumGrantRepository,
  });
  const afterCommit = new RecordingAfterCommitRegistry();
  const cache = new RecordingPremiumAccessCache();
  const logger = new SilentLogger();
  const useCase = new GrantPremiumUseCase({
    premiumGrantRepository,
    getPremiumEntitlements,
    projectPremiumAccess: new ProjectPremiumAccessUseCase({
      getPremiumEntitlements,
      premiumGrantRepository,
      userSubscriptionProjection: projection,
    }),
    userLock: new FakeUserMutationLock(knownUserIds),
    unitOfWork: new ImmediateUnitOfWork(),
    afterCommit,
    cache,
    clock: new FixedClock(NOW),
    logger,
  });
  return { useCase, premiumGrantRepository, projection, afterCommit, cache, logger };
}

const command = {
  userId: UserId.reconstitute(SUBSCRIPTION_FIXTURE_USER_ID),
  source: "INVITE",
  sourceKey: "invite:new",
  durationDays: 7,
} as const;

describe("GrantPremiumUseCase — 보상 기간 지급", () => {
  it("구독도 진행 중인 기간도 없으면 바로 시작하고 사용자를 ACTIVE로 올린다", async () => {
    // Given
    const { useCase, premiumGrantRepository, projection } = setup();

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({ status: "granted" });
    expect(premiumGrantRepository.all[0]?.toPrimitives()).toMatchObject({
      status: "ACTIVE",
      startsAt: NOW,
      endsAt: NOW.add({ milliseconds: 7 * DAY }),
    });
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: NOW.add({ milliseconds: 7 * DAY }),
    });
  });

  it("유효한 스토어 구독이 있으면 쌓아 두고 이어 붙인 끝까지 프리미엄이다", async () => {
    // Given
    const expiresAt = NOW.add({ milliseconds: 30 * DAY });
    const { useCase, premiumGrantRepository, projection } = setup({
      subscriptions: [createSubscriptionFixture({ expiresAt })],
    });

    // When
    await useCase.execute(command);

    // Then
    expect(premiumGrantRepository.all[0]?.toPrimitives()).toMatchObject({
      status: "BANKED",
      startsAt: null,
    });
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toMatchObject({
      subscriptionStatus: "ACTIVE",
    });
  });

  it("진행 중인 보상 기간이 있으면 새 보상은 쌓아 둔다", async () => {
    // Given
    const { useCase, premiumGrantRepository } = setup({ grants: [createPremiumGrantFixture()] });

    // When
    await useCase.execute(command);

    // Then
    expect(premiumGrantRepository.all.map((grant) => grant.status).toSorted()).toEqual([
      "ACTIVE",
      "BANKED",
    ]);
  });

  it("같은 출처 키는 한 번만 지급하고 duplicate를 돌려준다", async () => {
    // Given
    const { useCase, premiumGrantRepository, cache, afterCommit } = setup();
    await useCase.execute(command);

    // When
    const second = await useCase.execute(command);
    await afterCommit.runAll();

    // Then
    expect(second).toEqual({ status: "duplicate" });
    expect(premiumGrantRepository.all).toHaveLength(1);
    expect(cache.invalidatedUserIds).toEqual([SUBSCRIPTION_FIXTURE_USER_ID]);
  });

  it("사용자가 없으면 user-missing이고 아무것도 저장하지 않는다", async () => {
    // Given
    const { useCase, premiumGrantRepository } = setup({ knownUserIds: [] });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({ status: "user-missing" });
    expect(premiumGrantRepository.all).toEqual([]);
  });

  it("캐시는 커밋 뒤 작업으로만 비운다", async () => {
    // Given
    const { useCase, cache, afterCommit } = setup();

    // When
    await useCase.execute(command);
    const beforeCommit = [...cache.invalidatedUserIds];
    await afterCommit.runAll();

    // Then
    expect(beforeCommit).toEqual([]);
    expect(cache.invalidatedUserIds).toEqual([SUBSCRIPTION_FIXTURE_USER_ID]);
  });

  it("잘못된 기간은 SYS_0002로 거절하고 저장하지 않는다", async () => {
    // Given
    const { useCase, premiumGrantRepository } = setup();

    // When
    const result = useCase.execute({ ...command, durationDays: 0 });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(premiumGrantRepository.all).toEqual([]);
  });
});
