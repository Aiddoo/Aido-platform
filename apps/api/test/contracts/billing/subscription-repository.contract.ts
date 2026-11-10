import type { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import { StoreSubscriptionId } from "#api/modules/billing/subscriptions/domain/store-subscription-id.vo";
import type {
  Subscription,
  SubscriptionPrimitives,
} from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

const USER_ID = UserId.reconstitute(SUBSCRIPTION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(SUBSCRIPTION_FIXTURE_OTHER_USER_ID);
const LATER = SUBSCRIPTION_FIXTURE_NOW.add({ minutes: 1 });

async function saveSubscription(
  repository: SubscriptionRepositoryPort,
  overrides: Partial<SubscriptionPrimitives> = {},
): Promise<Subscription> {
  const subscription = createSubscriptionFixture({
    id: (await repository.nextId()).value,
    storeSubscriptionId: `chain-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  });
  await repository.save(subscription);
  return subscription;
}

export function describeSubscriptionRepositoryContract(
  createRepository: () => Promise<SubscriptionRepositoryPort>,
): void {
  describe("구독 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 구독은 체인 키로 같은 값을 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSubscription(repository, {
        environment: "SANDBOX",
        periodType: "TRIAL",
        lastProcessedEventId: "event-1",
      });

      // When
      const found = await repository.findByStoreSubscriptionId(saved.storeSubscriptionId);

      // Then
      expect(found?.toPrimitives()).toEqual(saved.toPrimitives());
    });

    it("다시 저장하면 상태·만료·유예·해지·이벤트·예약 상품·기간 유형만 덮어쓰고 시작 시각·소유자·결제 환경은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSubscription(repository, { environment: "PRODUCTION" });
      const changed = createSubscriptionFixture({
        ...saved.toPrimitives(),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        startedAt: LATER,
        environment: "SANDBOX",
        productId: "premium_yearly",
        status: "CANCELLED",
        expiresAt: LATER.add({ hours: 24 }),
        gracePeriodEndsAt: LATER.add({ hours: 48 }),
        cancelledAt: LATER,
        lastProcessedEventId: "event-2",
        nextProductId: "premium_monthly",
        periodType: "NORMAL",
        updatedAt: LATER,
      });

      // When
      await repository.save(changed);
      const found = await repository.findByStoreSubscriptionId(saved.storeSubscriptionId);

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...changed.toPrimitives(),
        userId: SUBSCRIPTION_FIXTURE_USER_ID,
        startedAt: saved.toPrimitives().startedAt,
        environment: "PRODUCTION",
      });
    });

    it("대조 대상은 그 사용자의 ACTIVE·CANCELLED 체인만 id 순서로 준다", async () => {
      // Given
      const repository = await createRepository();
      const active = await saveSubscription(repository, { status: "ACTIVE" });
      const cancelled = await saveSubscription(repository, { status: "CANCELLED" });
      await saveSubscription(repository, { status: "EXPIRED" });
      await saveSubscription(repository, { userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID });

      // When
      const reconcilable = await repository.listReconcilableByUserId(USER_ID);

      // Then
      expect(reconcilable.map((subscription) => subscription.id.value)).toEqual([
        active.id.value,
        cancelled.id.value,
      ]);
    });

    it("체인이 하나라도 있으면 exists가 true이고 다른 사용자는 false다", async () => {
      // Given
      const repository = await createRepository();
      await saveSubscription(repository);

      // When
      const owner = await repository.existsByUserId(USER_ID);
      const other = await repository.existsByUserId(OTHER_USER_ID);

      // Then
      expect({ owner, other }).toEqual({ owner: true, other: false });
    });

    it("claimChain은 다른 사용자의 체인만 옮기고 이미 소유자면 false다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSubscription(repository);

      // When
      const unchanged = await repository.claimChain(saved.storeSubscriptionId, USER_ID, LATER);
      const moved = await repository.claimChain(saved.storeSubscriptionId, OTHER_USER_ID, LATER);
      const found = await repository.findByStoreSubscriptionId(saved.storeSubscriptionId);

      // Then
      expect({ unchanged, moved, owner: found?.userId.value }).toEqual({
        unchanged: false,
        moved: true,
        owner: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      });
    });

    it("takeOverChains는 넘겨준 사용자의 체인을 모두 옮기고 옮긴 수를 준다", async () => {
      // Given
      const repository = await createRepository();
      await saveSubscription(repository);
      await saveSubscription(repository);

      // When
      const count = await repository.takeOverChains(USER_ID, OTHER_USER_ID, LATER);
      const remaining = await repository.existsByUserId(USER_ID);

      // Then
      expect({ count, remaining }).toEqual({ count: 2, remaining: false });
    });

    it("체인 키가 없으면 찾지 못한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const found = await repository.findByStoreSubscriptionId(StoreSubscriptionId.create("none"));

      // Then
      expect(found).toBeNull();
    });
  });
}
