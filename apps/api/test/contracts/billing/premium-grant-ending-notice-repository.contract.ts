import type { PremiumGrantEndingNoticeRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/premium-grant-ending-notice.repository.port";
import type { PremiumGrantRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/premium-grant.repository.port";
import { PremiumGrantId } from "#api/modules/billing/premium-grants/domain/premium-grant-id.vo";
import type { PremiumGrantPrimitives } from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";
import type { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import type { SubscriptionPrimitives } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import {
  createBankedPremiumGrantFixture,
  createPremiumGrantFixture,
  PREMIUM_GRANT_FIXTURE_NOW,
} from "#test/fixtures/billing/premium-grant.fixture";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

export interface PremiumGrantEndingNoticeHarness {
  readonly repository: PremiumGrantEndingNoticeRepositoryPort;
  readonly grants: PremiumGrantRepositoryPort;
  readonly subscriptions: SubscriptionRepositoryPort;
}

const NOW = PREMIUM_GRANT_FIXTURE_NOW;
const ENDS_BEFORE = NOW.add({ hours: 24 });

let sequence = 0;

async function saveGrant(
  grants: PremiumGrantRepositoryPort,
  overrides: Partial<PremiumGrantPrimitives> & { readonly banked?: boolean } = {},
): Promise<string> {
  sequence += 1;
  const { banked = false, ...rest } = overrides;
  const id = PremiumGrantId.generate().value;
  const create = banked ? createBankedPremiumGrantFixture : createPremiumGrantFixture;
  await grants.save(create({ id, sourceKey: `invite:ending-${sequence}`, ...rest }));
  return id;
}

async function saveSubscription(
  subscriptions: SubscriptionRepositoryPort,
  overrides: Partial<SubscriptionPrimitives>,
): Promise<void> {
  sequence += 1;
  const id = (await subscriptions.nextId()).value;
  await subscriptions.save(
    createSubscriptionFixture({
      id,
      storeSubscriptionId: `ending-chain-${sequence}`,
      ...overrides,
    }),
  );
}

function endingIn(hours: number): Partial<PremiumGrantPrimitives> {
  return { endsAt: NOW.add({ hours }) };
}

export function describePremiumGrantEndingNoticeRepositoryContract(
  createHarness: () => Promise<PremiumGrantEndingNoticeHarness>,
): void {
  describe("보상 기간 종료 안내 저장소 계약", () => {
    const window = { now: NOW, endsBefore: ENDS_BEFORE, limit: 10 };

    it("안내 기간 안에 끝나는 진행 중인 보상 기간을 끝나는 순서로 준다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      const later = await saveGrant(grants, endingIn(20));
      const sooner = await saveGrant(grants, {
        ...endingIn(10),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([sooner, later]);
    });

    it("이미 끝났거나 안내 기간 밖이거나 진행 중이 아닌 기간은 고르지 않는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, endingIn(-1));
      await saveGrant(grants, { ...endingIn(48), userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID });
      await saveGrant(grants, { status: "ENDED", ...endingIn(10) });
      await saveGrant(grants, { banked: true });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("이미 안내한 기간은 고르지 않는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, { ...endingIn(10), endingNotifiedAt: NOW });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("쌓아 둔 다음 보상 기간이 있으면 프리미엄이 이어지므로 고르지 않는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, endingIn(10));
      await saveGrant(grants, { banked: true });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("더 늦게 끝나는 다른 진행 중인 보상 기간이 있으면 앞의 기간은 고르지 않는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, endingIn(10));
      const last = await saveGrant(grants, endingIn(20));

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([last]);
    });

    it("다른 사용자의 쌓아 둔 기간은 이어지는 것으로 보지 않는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      const ending = await saveGrant(grants, endingIn(10));
      await saveGrant(grants, { banked: true, userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([ending]);
    });

    it("보상 기간 끝까지 이어지는 스토어 구독이 있으면 고르지 않는다", async () => {
      // Given
      const { repository, grants, subscriptions } = await createHarness();
      await saveGrant(grants, endingIn(10));
      await saveSubscription(subscriptions, {
        userId: SUBSCRIPTION_FIXTURE_USER_ID,
        status: "ACTIVE",
        expiresAt: NOW.add({ hours: 48 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("보상 기간보다 먼저 끝나는 스토어 구독이거나 이미 끝난 구독이면 보상 기간을 고른다", async () => {
      // Given
      const { repository, grants, subscriptions } = await createHarness();
      const ending = await saveGrant(grants, endingIn(10));
      await saveSubscription(subscriptions, { status: "ACTIVE", expiresAt: NOW.add({ hours: 5 }) });
      await saveSubscription(subscriptions, {
        status: "EXPIRED",
        expiresAt: NOW.add({ hours: 48 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([ending]);
    });

    it("결제 유예가 보상 기간 끝까지 이어지면 고르지 않는다", async () => {
      // Given
      const { repository, grants, subscriptions } = await createHarness();
      await saveGrant(grants, endingIn(10));
      await saveSubscription(subscriptions, {
        status: "ACTIVE",
        expiresAt: NOW.add({ hours: 2 }),
        gracePeriodEndsAt: NOW.add({ hours: 30 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("after 다음부터 limit만큼 이어서 읽는다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      const first = await saveGrant(grants, endingIn(5));
      const second = await saveGrant(grants, {
        ...endingIn(10),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      });
      const [head] = await repository.listDue({ ...window, limit: 1 });

      // When
      const next = await repository.listDue({
        ...window,
        ...(head != null && { after: head }),
        limit: 1,
      });

      // Then
      expect([head?.id.value, next.map((notice) => notice.id.value)]).toEqual([first, [second]]);
    });

    it("claim한 안내만 돌려주고 다시 claim하면 비어 있다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, endingIn(10));
      const due = await repository.listDue(window);

      // When
      const first = await repository.claim(due, NOW);
      const second = await repository.claim(due, NOW);

      // Then
      expect([first.length, second.length]).toEqual([1, 0]);
    });

    it("claim한 기간은 다음 listDue에서 빠진다", async () => {
      // Given
      const { repository, grants } = await createHarness();
      await saveGrant(grants, endingIn(10));
      await repository.claim(await repository.listDue(window), NOW);

      // When
      const remaining = await repository.listDue(window);

      // Then
      expect(remaining).toEqual([]);
    });

    it("claim할 안내가 없으면 빈 목록이다", async () => {
      // Given
      const { repository } = await createHarness();

      // When
      const claimed = await repository.claim([], NOW);

      // Then
      expect(claimed).toEqual([]);
    });
  });
}
