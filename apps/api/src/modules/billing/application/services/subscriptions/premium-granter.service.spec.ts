import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { AfterCommitTask } from "#api/shared/application/ports/index";
import { SUBSCRIPTION_TIME, createSubscriptionFixture } from "#test/fixtures/subscription.fixture";

import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import { PremiumGranter } from "./premium-granter.service.js";

function createGranter() {
  const fixture = createSubscriptionFixture();
  const afterCommit: AfterCommitTask[] = [];
  const logger = mock<ApplicationLogger>();
  const granter = new PremiumGranter({
    premiumGrantRepository: fixture.premiumGrantRepository,
    premiumAccessProjector: fixture.premiumAccessProjector,
    userMutationLock: fixture.userMutationLock,
    unitOfWork: fixture.unitOfWork,
    afterCommitTasks: { register: (task) => afterCommit.push(task) },
    cache: fixture.cache,
    logger,
  });
  return { fixture, granter, afterCommit, logger };
}

describe("PremiumGranter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("지급 기록 로그는 커밋 뒤 작업으로만 남겨 바깥 rollback 때 남지 않는다", async () => {
    // Given
    const { fixture, granter, afterCommit, logger } = createGranter();

    // When
    const result = await granter.grant({
      userId: fixture.user.id,
      source: "INVITE",
      sourceKey: "invite:after-commit",
      durationDays: 7,
    });
    const loggedBeforeCommit = logger.log.mock.calls.length;
    await Promise.all(afterCommit.map((task) => task()));

    // Then
    expect(result).toEqual({ status: "granted" });
    expect(loggedBeforeCommit).toBe(0);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: BillingLogEvent.PREMIUM_GRANT_RECORDED, reason: "granted" }),
    );
  });

  it("진행 중인 기간이 있으면 다음 보상은 미래에 시작하는 ACTIVE 대신 쌓아 둔다", async () => {
    // Given
    const { fixture, granter } = createGranter();
    await granter.grant({
      userId: fixture.user.id,
      source: "INVITE",
      sourceKey: "invite:first",
      durationDays: 7,
    });

    // When
    await granter.grant({
      userId: fixture.user.id,
      source: "INVITE",
      sourceKey: "invite:second",
      durationDays: 3,
    });

    // Then
    expect(
      [...fixture.premiumGrantRepository.grants.values()].map((grant) => [
        grant.sourceKey,
        grant.status,
      ]),
    ).toEqual([
      ["invite:first", "ACTIVE"],
      ["invite:second", "BANKED"],
    ]);
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2026-02-20T12:00:00.000Z"),
    });
  });
});
