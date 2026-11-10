import type { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import type { TrialEndingNoticeRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/trial-ending-notice.repository.port";
import type { SubscriptionPrimitives } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

export interface TrialEndingNoticeHarness {
  readonly repository: TrialEndingNoticeRepositoryPort;
  readonly subscriptions: SubscriptionRepositoryPort;
}

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const ENDS_BEFORE = NOW.add({ hours: 72 });

function trialEndingIn(hours: number): Partial<SubscriptionPrimitives> {
  return { periodType: "TRIAL", expiresAt: NOW.add({ hours }) };
}

let chainSequence = 0;

async function saveSubscription(
  subscriptions: SubscriptionRepositoryPort,
  overrides: Partial<SubscriptionPrimitives>,
): Promise<number> {
  chainSequence += 1;
  const id = (await subscriptions.nextId()).value;
  await subscriptions.save(
    createSubscriptionFixture({
      id,
      storeSubscriptionId: `trial-chain-${chainSequence}`,
      ...overrides,
    }),
  );
  return id;
}

export function describeTrialEndingNoticeRepositoryContract(
  createHarness: () => Promise<TrialEndingNoticeHarness>,
): void {
  describe("체험 종료 안내 저장소 계약", () => {
    it("안내 기간 안에 끝나는 체험 구독을 끝나는 순서로 준다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const later = await saveSubscription(subscriptions, trialEndingIn(48));
      const sooner = await saveSubscription(subscriptions, trialEndingIn(24));

      // When
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(due.map((notice) => notice.subscriptionId)).toEqual([sooner, later]);
    });

    it("체험이 아니거나 이미 끝났거나 안내 기간 밖이면 고르지 않는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, {
        periodType: "NORMAL",
        expiresAt: NOW.add({ hours: 24 }),
      });
      await saveSubscription(subscriptions, { ...trialEndingIn(24), status: "EXPIRED" });
      await saveSubscription(subscriptions, trialEndingIn(-1));
      await saveSubscription(subscriptions, trialEndingIn(96));

      // When
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(due).toEqual([]);
    });

    it("해지한 체험도 고르고 결제가 이어지는지(willRenew)는 상태로 알린다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, { ...trialEndingIn(24), status: "ACTIVE" });
      await saveSubscription(subscriptions, { ...trialEndingIn(48), status: "CANCELLED" });

      // When
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(due.map((notice) => notice.willRenew)).toEqual([true, false]);
    });

    it("체험 뒤 요금제는 상품 ID로 알리고 모르는 상품이면 null이다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, {
        ...trialEndingIn(24),
        productId: "com.aido.pro.yearly",
      });
      await saveSubscription(subscriptions, {
        ...trialEndingIn(48),
        productId: "com.aido.pro.monthly:base",
      });
      await saveSubscription(subscriptions, { ...trialEndingIn(60), productId: "unknown_product" });

      // When
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(due.map((notice) => notice.planType)).toEqual(["ANNUAL", "MONTHLY", null]);
    });

    it("사용자와 시작 시각과 만료 시각을 그대로 담는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, {
        ...trialEndingIn(24),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      });

      // When
      const [notice] = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(notice?.userId).toBe(SUBSCRIPTION_FIXTURE_OTHER_USER_ID);
      expect(notice?.startedAt.equals(NOW)).toBe(true);
      expect(notice?.expiresAt.equals(NOW.add({ hours: 24 }))).toBe(true);
    });

    it("after 다음부터 limit만큼 이어서 읽는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const ids = [
        await saveSubscription(subscriptions, trialEndingIn(12)),
        await saveSubscription(subscriptions, trialEndingIn(24)),
        await saveSubscription(subscriptions, trialEndingIn(36)),
      ];
      const [first] = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 1 });

      // When
      const next = await repository.listDue({
        now: NOW,
        endsBefore: ENDS_BEFORE,
        ...(first != null && { after: first }),
        limit: 1,
      });

      // Then
      expect([first?.subscriptionId, next.map((notice) => notice.subscriptionId)]).toEqual([
        ids[0],
        [ids[1]],
      ]);
    });

    it("claim한 안내만 돌려주고 다시 claim하면 비어 있다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, trialEndingIn(24));
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // When
      const first = await repository.claim(due, NOW);
      const second = await repository.claim(due, NOW);

      // Then
      expect([first.length, second.length]).toEqual([1, 0]);
    });

    it("claim한 체험은 다음 listDue에서 빠진다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, trialEndingIn(24));
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });
      await repository.claim(due, NOW);

      // When
      const remaining = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });

      // Then
      expect(remaining).toEqual([]);
    });

    it("이미 claim한 안내가 섞여 있으면 새 안내만 돌려준다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, trialEndingIn(24));
      await saveSubscription(subscriptions, trialEndingIn(36));
      const due = await repository.listDue({ now: NOW, endsBefore: ENDS_BEFORE, limit: 10 });
      await repository.claim(due.slice(0, 1), NOW);

      // When
      const claimed = await repository.claim(due, NOW);

      // Then
      expect(claimed.map((notice) => notice.subscriptionId)).toEqual(
        due.slice(1).map((notice) => notice.subscriptionId),
      );
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
