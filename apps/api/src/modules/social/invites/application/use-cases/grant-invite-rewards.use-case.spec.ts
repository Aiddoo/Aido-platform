import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { RecordingInviteNotifier } from "#test/doubles/social/recording-invite-notifier";
import { RecordingRewardApplier } from "#test/doubles/social/recording-reward-applier";
import { RollbackRewardGrantUnitOfWork } from "#test/doubles/social/rollback-reward-grant-unit-of-work";
import {
  createInviteRedemptionFixture,
  INVITE_REDEMPTION_FIXTURE_ID,
} from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteAlerts } from "../invites.alerts.js";
import { GrantInviteRewardsUseCase } from "./grant-invite-rewards.use-case.js";

const NOW = INVITE_FIXTURE_NOW.add({ hours: 1 });
const REDEMPTION_ID = InviteRedemptionId.reconstitute(INVITE_REDEMPTION_FIXTURE_ID);
const PREMIUM_GRANT_ID = "c0000000000000000000grt01";

function createGranter(options: { readonly isEnabled?: boolean; readonly attempts?: number } = {}) {
  const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository([
    createInviteRedemptionFixture({ status: "QUALIFIED", qualifiedAt: INVITE_FIXTURE_NOW }),
  ]);
  const rewardGrantRepository = new InMemoryRewardGrantRepository([
    createRewardGrantFixture({ id: PREMIUM_GRANT_ID, attempts: options.attempts ?? 0 }),
    createRewardGrantFixture({
      id: "c0000000000000000000grt02",
      rewardType: "FRIEND_SLOT",
      quantity: 1,
    }),
  ]);
  const rewardApplier = new RecordingRewardApplier();
  const notifier = new RecordingInviteNotifier();
  const alert = new RecordingOperationalAlert();
  const useCase = new GrantInviteRewardsUseCase({
    unitOfWork: new RollbackRewardGrantUnitOfWork(rewardGrantRepository),
    rewardGrantRepository,
    inviteRedemptionRepository,
    rewardApplier,
    notifier,
    alert,
    inviteConfig: { isEnabled: options.isEnabled ?? true },
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return {
    useCase,
    inviteRedemptionRepository,
    rewardGrantRepository,
    rewardApplier,
    notifier,
    alert,
  };
}

describe("GrantInviteRewardsUseCase — 초대 보상 지급", () => {
  it("남은 지급을 모두 적용하면 보상 완료로 바꾸고 초대한 사람에게 합계로 한 번 알린다", async () => {
    // Given
    const granter = createGranter();

    // When
    const first = await granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: true,
    });
    const rerun = await granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: true,
    });

    // Then
    expect([first, rerun]).toEqual([
      { appliedCount: 2, failedCount: 0 },
      { appliedCount: 0, failedCount: 0 },
    ]);
    expect(granter.rewardApplier.applied.map((grant) => grant.rewardType)).toEqual([
      "PREMIUM_DAYS",
      "FRIEND_SLOT",
    ]);
    const redemption = await granter.inviteRedemptionRepository.findByIdForUpdate(REDEMPTION_ID);
    expect(redemption?.toPrimitives()).toMatchObject({ status: "REWARDED", rewardedAt: NOW });
    expect(granter.notifier.rewarded).toEqual([
      {
        recipientId: INVITE_FIXTURE_INVITER_ID,
        redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
        premiumDays: 7,
        friendSlots: 1,
      },
    ]);
  });

  it("적용이 실패하면 그 지급만 FAILED로 남기고 큐 재시도로 넘기며 큐 재시도는 시도 횟수를 늘리지 않는다", async () => {
    // Given
    const granter = createGranter();
    granter.rewardApplier.failing = (grant) => grant.rewardType === "PREMIUM_DAYS";

    // When
    const firstRun = granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: true,
    });
    await expect(firstRun).rejects.toMatchObject({
      name: "InviteRewardGrantFailedError",
      failedCount: 1,
    });
    const queueRetry = granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: false,
    });
    await expect(queueRetry).rejects.toMatchObject({ failedCount: 1 });

    // Then
    const grants = await granter.rewardGrantRepository.listByRedemptionId(REDEMPTION_ID);
    expect(grants.map((grant) => [grant.rewardType, grant.status, grant.attempts])).toEqual([
      ["PREMIUM_DAYS", "FAILED", 1],
      ["FRIEND_SLOT", "APPLIED", 0],
    ]);
    const redemption = await granter.inviteRedemptionRepository.findByIdForUpdate(REDEMPTION_ID);
    expect(redemption?.status).toBe("QUALIFIED");
    expect(granter.notifier.rewarded).toEqual([]);
  });

  it("마지막 정비 재시도가 실패하면 사람이 다시 적용하도록 한 번 경보한다", async () => {
    // Given
    const granter = createGranter({ attempts: 4 });
    granter.rewardApplier.failing = () => true;

    // When
    const result = granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: true,
    });

    // Then
    await expect(result).rejects.toMatchObject({ failedCount: 2 });
    expect(granter.alert.alerts).toEqual([
      {
        ...InviteAlerts.REWARD_RETRY_EXHAUSTED,
        tags: { errorCode: "APPLY_FAILED" },
        details: {
          grantId: PREMIUM_GRANT_ID,
          redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
          rewardType: "PREMIUM_DAYS",
          attempts: 5,
        },
      },
    ]);
  });

  it("기능이 꺼져 있으면 아무것도 적용하지 않고 원장을 그대로 둔다", async () => {
    // Given
    const granter = createGranter({ isEnabled: false });

    // When
    const result = await granter.useCase.execute({
      redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      countsAttempt: true,
    });

    // Then
    expect(result).toEqual({ appliedCount: 0, failedCount: 0 });
    expect(granter.rewardApplier.applied).toEqual([]);
    const grants = await granter.rewardGrantRepository.listByRedemptionId(REDEMPTION_ID);
    expect(grants.every((grant) => grant.status === "PENDING")).toBe(true);
  });
});
