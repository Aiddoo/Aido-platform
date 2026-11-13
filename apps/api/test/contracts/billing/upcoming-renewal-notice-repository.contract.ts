import type { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import type { UpcomingRenewalNoticeRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/upcoming-renewal-notice.repository.port";
import type { SubscriptionPrimitives } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

export interface UpcomingRenewalNoticeHarness {
  readonly repository: UpcomingRenewalNoticeRepositoryPort;
  readonly subscriptions: SubscriptionRepositoryPort;
}

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const ENDS_BEFORE = NOW.add({ hours: 24 * 7 });
const ANNUAL = "com.aido.pro.yearly";
const MONTHLY = "com.aido.pro.monthly";

function annualRenewingIn(hours: number): Partial<SubscriptionPrimitives> {
  return { productId: ANNUAL, expiresAt: NOW.add({ hours }) };
}

let chainSequence = 0;

async function saveSubscription(
  subscriptions: SubscriptionRepositoryPort,
  overrides: Partial<SubscriptionPrimitives>,
): Promise<{ readonly id: number; readonly storeSubscriptionId: string }> {
  chainSequence += 1;
  const id = (await subscriptions.nextId()).value;
  const storeSubscriptionId = `renewal-chain-${chainSequence}`;
  await subscriptions.save(createSubscriptionFixture({ id, storeSubscriptionId, ...overrides }));
  return { id, storeSubscriptionId };
}

export function describeUpcomingRenewalNoticeRepositoryContract(
  createHarness: () => Promise<UpcomingRenewalNoticeHarness>,
): void {
  describe("갱신 예정 안내 저장소 계약", () => {
    const window = { now: NOW, endsBefore: ENDS_BEFORE, limit: 10 };

    it("안내 기간 안에 갱신될 연간 구독을 끝나는 순서로 준다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const later = await saveSubscription(subscriptions, annualRenewingIn(120));
      const sooner = await saveSubscription(subscriptions, annualRenewingIn(48));

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([sooner.id, later.id]);
    });

    it("월간이거나 안내 기간 밖이거나 이미 끝난 구독은 고르지 않는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, {
        productId: MONTHLY,
        expiresAt: NOW.add({ hours: 48 }),
      });
      await saveSubscription(subscriptions, annualRenewingIn(24 * 8));
      await saveSubscription(subscriptions, annualRenewingIn(-1));

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due).toEqual([]);
    });

    it("자동 갱신 중(ACTIVE)이고 일반 기간(null·NORMAL)인 구독만 고른다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, { ...annualRenewingIn(24), status: "CANCELLED" });
      await saveSubscription(subscriptions, { ...annualRenewingIn(36), periodType: "TRIAL" });
      const normal = await saveSubscription(subscriptions, {
        ...annualRenewingIn(48),
        periodType: "NORMAL",
      });
      const unset = await saveSubscription(subscriptions, {
        ...annualRenewingIn(60),
        periodType: null,
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([normal.id, unset.id]);
    });

    it("예약한 상품 변경이 있으면 다음 결제 상품으로 연간 여부를 본다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const toAnnual = await saveSubscription(subscriptions, {
        productId: MONTHLY,
        nextProductId: ANNUAL,
        expiresAt: NOW.add({ hours: 24 }),
      });
      await saveSubscription(subscriptions, {
        productId: ANNUAL,
        nextProductId: MONTHLY,
        expiresAt: NOW.add({ hours: 36 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([toAnnual.id]);
    });

    it("Play 기본요금제가 붙은 상품 ID도 연간으로 본다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const play = await saveSubscription(subscriptions, {
        productId: `${ANNUAL}:base`,
        expiresAt: NOW.add({ hours: 24 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.id.value)).toEqual([play.id]);
    });

    it("사용자의 현재 체인만 isCurrentChain이고 요금제를 바꾸고 남은 옛 체인은 아니다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const old = await saveSubscription(subscriptions, {
        ...annualRenewingIn(48),
        startedAt: NOW.subtract({ hours: 24 * 300 }),
      });
      const current = await saveSubscription(subscriptions, {
        ...annualRenewingIn(72),
        startedAt: NOW.subtract({ hours: 24 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => [notice.id.value, notice.toPrimitives().isCurrentChain])).toEqual([
        [old.id, false],
        [current.id, true],
      ]);
    });

    it("다른 사용자의 체인은 현재 체인 판단에 섞지 않는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, {
        ...annualRenewingIn(48),
        startedAt: NOW.subtract({ hours: 24 * 300 }),
      });
      await saveSubscription(subscriptions, {
        ...annualRenewingIn(72),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        startedAt: NOW.subtract({ hours: 24 }),
      });

      // When
      const due = await repository.listDue(window);

      // Then
      expect(due.map((notice) => notice.toPrimitives().isCurrentChain)).toEqual([true, true]);
    });

    it("after 다음부터 limit만큼 이어서 읽는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const first = await saveSubscription(subscriptions, annualRenewingIn(24));
      const second = await saveSubscription(subscriptions, annualRenewingIn(48));
      const [head] = await repository.listDue({ ...window, limit: 1 });

      // When
      const next = await repository.listDue({
        ...window,
        ...(head != null && { after: head }),
        limit: 1,
      });

      // Then
      expect([head?.id.value, next.map((notice) => notice.id.value)]).toEqual([
        first.id,
        [second.id],
      ]);
    });

    it("claim한 안내만 돌려주고 다시 claim하면 비어 있다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      await saveSubscription(subscriptions, annualRenewingIn(24));
      const due = await repository.listDue(window);

      // When
      const first = await repository.claim(due, NOW);
      const second = await repository.claim(due, NOW);

      // Then
      expect([first.length, second.length]).toEqual([1, 0]);
    });

    it("claim한 기간은 다음 listDue에서 빠지고 갱신돼 기간이 바뀌면 다시 고른다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const { id, storeSubscriptionId } = await saveSubscription(
        subscriptions,
        annualRenewingIn(24),
      );
      await repository.claim(await repository.listDue(window), NOW);
      const afterClaim = await repository.listDue(window);
      await subscriptions.save(
        createSubscriptionFixture({
          id,
          storeSubscriptionId,
          ...annualRenewingIn(24 * 3),
        }),
      );

      // When
      const afterRenewal = await repository.listDue(window);

      // Then
      expect([afterClaim, afterRenewal.map((notice) => notice.id.value)]).toEqual([[], [id]]);
    });

    it("읽은 뒤 기간이 바뀐 구독은 claim하지 않는다", async () => {
      // Given
      const { repository, subscriptions } = await createHarness();
      const { id, storeSubscriptionId } = await saveSubscription(
        subscriptions,
        annualRenewingIn(24),
      );
      const due = await repository.listDue(window);
      await subscriptions.save(
        createSubscriptionFixture({ id, storeSubscriptionId, ...annualRenewingIn(24 * 3) }),
      );

      // When
      const claimed = await repository.claim(due, NOW);

      // Then
      expect(claimed).toEqual([]);
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
