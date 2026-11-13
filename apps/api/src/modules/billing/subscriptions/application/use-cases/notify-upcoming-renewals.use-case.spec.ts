import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryUpcomingRenewalNoticeRepository } from "#test/doubles/billing/in-memory-upcoming-renewal-notice.repository";
import { RecordingBillingNoticeNotifier } from "#test/doubles/billing/recording-billing-notice-notifier";
import { StubQuietHoursReader } from "#test/doubles/billing/stub-quiet-hours.reader";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import { SweepBillingNoticesUseCase } from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type { Subscription, SubscriptionPrimitives } from "../../domain/subscription.aggregate.js";
import type { UpcomingRenewalNotice } from "../../domain/upcoming-renewal-notice.entity.js";
import { NotifyUpcomingRenewalsUseCase } from "./notify-upcoming-renewals.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY_HOURS = 24;

function annual(id: number, overrides: Partial<SubscriptionPrimitives>) {
  return createSubscriptionFixture({
    id,
    storeSubscriptionId: `renewal-chain-${id}`,
    productId: "com.aido.pro.yearly",
    expiresAt: NOW.add({ hours: 3 * DAY_HOURS }),
    ...overrides,
  });
}

function setup(subscriptions: Subscription[]) {
  const subscriptionRepository = new InMemorySubscriptionRepository(subscriptions);
  const notifier = new RecordingBillingNoticeNotifier<UpcomingRenewalNotice>();
  const useCase = new NotifyUpcomingRenewalsUseCase({
    sweepBillingNotices: new SweepBillingNoticesUseCase({
      quietHoursReader: new StubQuietHoursReader(),
      unitOfWork: new ImmediateUnitOfWork(),
      logger: new SilentLogger(),
    }),
    noticeRepository: new InMemoryUpcomingRenewalNoticeRepository(subscriptionRepository),
    notifier,
  });
  return { useCase, notifier, subscriptionRepository };
}

describe("NotifyUpcomingRenewalsUseCase — 갱신 예정 안내", () => {
  it("7일 안에 갱신될 연간 구독만 안내하고 월간은 보내지 않는다", async () => {
    // Given
    const { useCase, notifier } = setup([
      annual(1, {}),
      annual(2, { productId: "com.aido.pro.monthly", userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result.notifiedCount).toBe(1);
    expect(notifier.notified.map((notice) => notice.id.value)).toEqual([1]);
  });

  it("요금제를 바꾸고 남은 옛 체인은 다음 결제를 정하지 않아 건너뛴다", async () => {
    // Given
    const { useCase, notifier } = setup([
      annual(1, { startedAt: NOW.subtract({ hours: 300 * DAY_HOURS }) }),
      annual(2, {
        startedAt: NOW.subtract({ hours: 1 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 5 * DAY_HOURS }),
      }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 1, skippedCount: 1 });
    expect(notifier.notified.map((notice) => notice.id.value)).toEqual([2]);
  });

  it("같은 기간은 한 번만 안내하고 갱신돼 새 기간이 되면 다시 안내한다", async () => {
    // Given
    const { useCase, notifier, subscriptionRepository } = setup([annual(1, {})]);
    await useCase.execute({ now: NOW });
    const second = await useCase.execute({ now: NOW });
    await subscriptionRepository.save(annual(1, { expiresAt: NOW.add({ hours: 5 * DAY_HOURS }) }));

    // When
    const afterRenewal = await useCase.execute({ now: NOW });

    // Then
    expect([second.notifiedCount, afterRenewal.notifiedCount]).toEqual([0, 1]);
    expect(notifier.notified).toHaveLength(2);
  });
});
