import type { SubscriptionStatus } from "@aido/api/vocabulary";

import { GetPremiumEntitlementsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/get-premium-entitlements.use-case";
import { ProjectPremiumAccessUseCase } from "#api/modules/billing/premium-grants/application/use-cases/project-premium-access.use-case";
import { FakeUserMutationLock } from "#test/doubles/billing/fake-user-mutation-lock";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemoryStoreEntitlementReader } from "#test/doubles/billing/in-memory-store-entitlement.reader";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryUserSubscriptionProjectionRepository } from "#test/doubles/billing/in-memory-user-subscription-projection.repository";
import { RecordingPremiumAccessCache } from "#test/doubles/billing/recording-premium-access-cache";
import { StubStoreSubscriptionStatusReader } from "#test/doubles/billing/stub-store-subscription-status.reader";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_CHAIN_ID,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import type { StoreSubscriptionState } from "../../domain/subscription.aggregate.js";
import { ReconcileStoreSubscriptionsUseCase } from "./reconcile-store-subscriptions.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const AT = NOW.add({ hours: 24 });
const EXPIRES_AT = NOW.add({ hours: 24 * 30 });
const RENEWED_EXPIRES_AT = NOW.add({ hours: 24 * 60 });

function storeState(overrides: Partial<StoreSubscriptionState> = {}): StoreSubscriptionState {
  return {
    storeSubscriptionId: SUBSCRIPTION_FIXTURE_CHAIN_ID,
    productId: null,
    periodEndsAt: EXPIRES_AT,
    willRenew: true,
    isTrial: false,
    givesAccess: true,
    ...overrides,
  };
}

function setup(
  options: {
    status?: Extract<SubscriptionStatus, "ACTIVE" | "CANCELLED" | "EXPIRED">;
    states?: StoreSubscriptionState[];
  } = {},
) {
  const subscriptionRepository = new InMemorySubscriptionRepository([
    createSubscriptionFixture({ status: options.status ?? "ACTIVE", expiresAt: EXPIRES_AT }),
  ]);
  const premiumGrantRepository = new InMemoryPremiumGrantRepository();
  const projection = new InMemoryUserSubscriptionProjectionRepository([
    SUBSCRIPTION_FIXTURE_USER_ID,
  ]);
  const statusReader = new StubStoreSubscriptionStatusReader();
  for (const state of options.states ?? []) {
    statusReader.states.set(state.storeSubscriptionId, state);
  }
  const cache = new RecordingPremiumAccessCache();
  const useCase = new ReconcileStoreSubscriptionsUseCase({
    subscriptionRepository,
    statusReader,
    userLock: new FakeUserMutationLock([SUBSCRIPTION_FIXTURE_USER_ID]),
    unitOfWork: new ImmediateUnitOfWork(),
    projectPremiumAccess: new ProjectPremiumAccessUseCase({
      getPremiumEntitlements: new GetPremiumEntitlementsUseCase({
        storeEntitlementReader: new InMemoryStoreEntitlementReader(subscriptionRepository),
        premiumGrantRepository,
      }),
      premiumGrantRepository,
      userSubscriptionProjection: projection,
    }),
    cache,
  });
  return { useCase, subscriptionRepository, projection, cache, statusReader };
}

const command = { userId: SUBSCRIPTION_FIXTURE_USER_ID, now: AT };

describe("ReconcileStoreSubscriptionsUseCase — 스토어 상태 대조", () => {
  it("놓친 갱신은 스토어 만료로 맞추고 프리미엄을 다시 계산해 캐시를 비운다", async () => {
    // Given
    const { useCase, subscriptionRepository, projection, cache } = setup({
      states: [storeState({ periodEndsAt: RENEWED_EXPIRES_AT })],
    });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({ correctedCount: 1, fields: ["expiresAt"] });
    expect(subscriptionRepository.all[0]?.expiresAt).toEqual(RENEWED_EXPIRES_AT);
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: RENEWED_EXPIRES_AT,
    });
    expect(cache.invalidatedUserIds).toEqual([SUBSCRIPTION_FIXTURE_USER_ID]);
  });

  it("스토어가 접근을 주지 않는 체인은 지금 끝낸다", async () => {
    // Given
    const { useCase, subscriptionRepository } = setup({
      states: [storeState({ givesAccess: false })],
    });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result.correctedCount).toBe(1);
    expect(subscriptionRepository.all[0]?.status).toBe("EXPIRED");
  });

  it("스토어와 같으면 프리미엄도 캐시도 건드리지 않는다", async () => {
    // Given
    const { useCase, projection, cache } = setup({ states: [storeState()] });

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({ correctedCount: 0, fields: [] });
    expect(projection.projections.get(SUBSCRIPTION_FIXTURE_USER_ID)).toMatchObject({
      subscriptionStatus: "FREE",
    });
    expect(cache.invalidatedUserIds).toEqual([]);
  });

  it("스토어가 모르는 체인이나 읽기 설정이 없으면 바꾸지 않는다", async () => {
    // Given
    const { useCase, subscriptionRepository } = setup();

    // When
    const result = await useCase.execute(command);

    // Then
    expect(result).toEqual({ correctedCount: 0, fields: [] });
    expect(subscriptionRepository.all[0]?.status).toBe("ACTIVE");
  });

  it("스토어 읽기가 실패하면 아무것도 바꾸지 않고 던진다", async () => {
    // Given
    const { useCase, statusReader, subscriptionRepository } = setup();
    statusReader.failure = new Error("revenuecat down");

    // When
    const result = useCase.execute(command);

    // Then
    await expect(result).rejects.toThrow("revenuecat down");
    expect(subscriptionRepository.all[0]?.status).toBe("ACTIVE");
  });

  it("대조할 체인이 없는 사용자는 스토어를 읽지 않는다", async () => {
    // Given
    const { useCase, statusReader } = setup({ status: "EXPIRED" });
    const read = vi.spyOn(statusReader, "read");

    // When
    await useCase.execute(command);

    // Then
    expect(read).not.toHaveBeenCalled();
  });
});
