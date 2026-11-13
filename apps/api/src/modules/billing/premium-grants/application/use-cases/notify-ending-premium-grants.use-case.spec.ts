import { InMemoryPremiumGrantEndingNoticeRepository } from "#test/doubles/billing/in-memory-premium-grant-ending-notice.repository";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { RecordingBillingNoticeNotifier } from "#test/doubles/billing/recording-billing-notice-notifier";
import { StubQuietHoursReader } from "#test/doubles/billing/stub-quiet-hours.reader";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createBankedPremiumGrantFixture,
  createPremiumGrantFixture,
  PREMIUM_GRANT_FIXTURE_NOW,
} from "#test/fixtures/billing/premium-grant.fixture";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import { SweepBillingNoticesUseCase } from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";
import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import { NotifyEndingPremiumGrantsUseCase } from "./notify-ending-premium-grants.use-case.js";

const NOW = PREMIUM_GRANT_FIXTURE_NOW;

function setup(grants: PremiumGrant[], subscriptions = new InMemorySubscriptionRepository()) {
  const grantRepository = new InMemoryPremiumGrantRepository(grants);
  const notifier = new RecordingBillingNoticeNotifier<PremiumGrantEndingNotice>();
  const useCase = new NotifyEndingPremiumGrantsUseCase({
    sweepBillingNotices: new SweepBillingNoticesUseCase({
      quietHoursReader: new StubQuietHoursReader(),
      unitOfWork: new ImmediateUnitOfWork(),
      logger: new SilentLogger(),
    }),
    noticeRepository: new InMemoryPremiumGrantEndingNoticeRepository(
      grantRepository,
      subscriptions,
    ),
    notifier,
  });
  return { useCase, notifier };
}

describe("NotifyEndingPremiumGrantsUseCase — 보상 기간 종료 안내", () => {
  it("24시간 안에 끝나는 마지막 보상 기간만 안내한다", async () => {
    // Given
    const { useCase, notifier } = setup([
      createPremiumGrantFixture({
        id: "grant-soon",
        sourceKey: "invite:soon",
        endsAt: NOW.add({ hours: 10 }),
      }),
      createPremiumGrantFixture({
        id: "grant-far",
        sourceKey: "invite:far",
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        endsAt: NOW.add({ hours: 72 }),
      }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result.notifiedCount).toBe(1);
    expect(notifier.notified.map((notice) => notice.id.value)).toEqual(["grant-soon"]);
  });

  it("하루짜리 보상도 시작 직후 끝나기 전에 안내한다", async () => {
    // Given
    const { useCase, notifier } = setup([
      createPremiumGrantFixture({ durationDays: 1, endsAt: NOW.add({ hours: 24 }) }),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 1, skippedCount: 0 });
    expect(notifier.notified).toHaveLength(1);
  });

  it("뒤에 쌓아 둔 보상 기간이 있으면 프리미엄이 이어지므로 안내하지 않는다", async () => {
    // Given
    const { useCase, notifier } = setup([
      createPremiumGrantFixture({ endsAt: NOW.add({ hours: 10 }) }),
      createBankedPremiumGrantFixture(),
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result.notifiedCount).toBe(0);
    expect(notifier.notified).toEqual([]);
  });

  it("보상 기간 뒤로 이어지는 스토어 구독이 있으면 안내하지 않는다", async () => {
    // Given
    const subscriptions = new InMemorySubscriptionRepository([
      createSubscriptionFixture({ expiresAt: NOW.add({ hours: 24 * 30 }) }),
    ]);
    const { useCase, notifier } = setup(
      [createPremiumGrantFixture({ endsAt: NOW.add({ hours: 10 }) })],
      subscriptions,
    );

    // When
    await useCase.execute({ now: NOW });

    // Then
    expect(notifier.notified).toEqual([]);
  });

  it("같은 보상 기간은 두 번 안내하지 않는다", async () => {
    // Given
    const { useCase, notifier } = setup([
      createPremiumGrantFixture({ endsAt: NOW.add({ hours: 10 }) }),
    ]);

    // When
    await useCase.execute({ now: NOW });
    const second = await useCase.execute({ now: NOW });

    // Then
    expect(second.notifiedCount).toBe(0);
    expect(notifier.notified).toHaveLength(1);
  });
});
