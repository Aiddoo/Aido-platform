import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryTrialEndingNoticeRepository } from "#test/doubles/billing/in-memory-trial-ending-notice.repository";
import { RecordingBillingNoticeNotifier } from "#test/doubles/billing/recording-billing-notice-notifier";
import { StubQuietHoursReader } from "#test/doubles/billing/stub-quiet-hours.reader";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import { SweepBillingNoticesUseCase } from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type { Subscription, SubscriptionPrimitives } from "../../domain/subscription.aggregate.js";
import type { TrialEndingNotice } from "../ports/trial-ending-notice.repository.port.js";
import { NotifyEndingTrialsUseCase } from "./notify-ending-trials.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY_HOURS = 24;

function trial(id: number, overrides: Partial<SubscriptionPrimitives>) {
  return createSubscriptionFixture({
    id,
    storeSubscriptionId: `trial-chain-${id}`,
    periodType: "TRIAL",
    ...overrides,
  });
}

function setup(subscriptions: Subscription[], quietUserIds: string[] = []) {
  const subscriptionRepository = new InMemorySubscriptionRepository(subscriptions);
  const noticeRepository = new InMemoryTrialEndingNoticeRepository(subscriptionRepository);
  const notifier = new RecordingBillingNoticeNotifier<TrialEndingNotice>();
  const useCase = new NotifyEndingTrialsUseCase({
    sweepBillingNotices: new SweepBillingNoticesUseCase({
      quietHoursReader: new StubQuietHoursReader(quietUserIds),
      unitOfWork: new ImmediateUnitOfWork(),
      logger: new SilentLogger(),
    }),
    noticeRepository,
    notifier,
  });
  return { useCase, notifier };
}

describe("NotifyEndingTrialsUseCase — 체험 종료 안내", () => {
  it("3일 안에 끝나는 체험을 끝나는 순서로 안내한다", async () => {
    // Given
    const { useCase, notifier } = setup([
      trial(1, {
        startedAt: NOW.subtract({ hours: 4 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 2 * DAY_HOURS }),
      }),
      trial(2, {
        startedAt: NOW.subtract({ hours: 6 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 1 * DAY_HOURS }),
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      }),
      trial(3, {
        startedAt: NOW.subtract({ hours: 1 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 6 * DAY_HOURS }),
      }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 2, skippedCount: 0 });
    expect(notifier.notified.map((notice) => notice.subscriptionId)).toEqual([2, 1]);
  });

  it("시작할 때 이미 3일 이하로 남았던 짧은 체험은 안내하지 않고 건너뛴 수로 센다", async () => {
    // Given
    const { useCase, notifier } = setup([
      trial(1, {
        startedAt: NOW.subtract({ hours: 1 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 2 * DAY_HOURS }),
      }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 0, skippedCount: 1 });
    expect(notifier.notified).toEqual([]);
  });

  it("해지해 결제가 이어지지 않는 체험도 안내하며 willRenew로 구분한다", async () => {
    // Given
    const { useCase, notifier } = setup([
      trial(1, {
        status: "CANCELLED",
        startedAt: NOW.subtract({ hours: 5 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 1 * DAY_HOURS }),
      }),
    ]);

    // When
    await useCase.execute({ now: NOW });

    // Then
    expect(notifier.notified.map((notice) => notice.willRenew)).toEqual([false]);
  });

  it("현지 야간인 사용자는 미루고 표시하지 않아 다음 실행이 보낸다", async () => {
    // Given
    const { useCase, notifier } = setup(
      [
        trial(1, {
          userId: SUBSCRIPTION_FIXTURE_USER_ID,
          startedAt: NOW.subtract({ hours: 5 * DAY_HOURS }),
          expiresAt: NOW.add({ hours: 1 * DAY_HOURS }),
        }),
      ],
      [SUBSCRIPTION_FIXTURE_USER_ID],
    );

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 0, deferredCount: 1 });
    expect(notifier.notified).toEqual([]);
  });

  it("같은 체험은 두 번 안내하지 않는다", async () => {
    // Given
    const { useCase, notifier } = setup([
      trial(1, {
        startedAt: NOW.subtract({ hours: 5 * DAY_HOURS }),
        expiresAt: NOW.add({ hours: 1 * DAY_HOURS }),
      }),
    ]);

    // When
    await useCase.execute({ now: NOW });
    const second = await useCase.execute({ now: NOW });

    // Then
    expect(second.notifiedCount).toBe(0);
    expect(notifier.notified).toHaveLength(1);
  });
});
