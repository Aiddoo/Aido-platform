import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { StubInviteCodeGenerator } from "#test/doubles/social/stub-invite-code-generator";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  inviteFixtureInviteeId,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

import { InviteCode } from "../../domain/invite-code.vo.js";
import { InviteLockKeys } from "../invites.lock-keys.js";
import { GetMyInviteUseCase } from "./get-my-invite.use-case.js";
import { IssueInviteUseCase } from "./issue-invite.use-case.js";
import { RotateInviteCodeUseCase } from "./rotate-invite-code.use-case.js";
import { SummarizeMyInviteUseCase } from "./summarize-my-invite.use-case.js";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const NOW = INVITE_FIXTURE_NOW.add({ hours: 1 });

function createMyInviteUseCases(
  options: { readonly isEnabled?: boolean; readonly codes?: readonly string[] } = {},
) {
  const inviteRepository = new InMemoryInviteRepository();
  const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository();
  const rewardGrantRepository = new InMemoryRewardGrantRepository();
  const mutationLock = new RecordingMutationLock();
  const logger = new SilentLogger();
  const shared = {
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    inviteRepository,
    issueInvite: new IssueInviteUseCase({
      inviteRepository,
      codeGenerator: new StubInviteCodeGenerator(options.codes ?? ["K7M2QX", "B2C3D4"]),
    }),
    summarizeMyInvite: new SummarizeMyInviteUseCase({
      inviteRedemptionRepository,
      rewardGrantRepository,
    }),
    inviteConfig: { isEnabled: options.isEnabled ?? true },
    clock: new FixedClock(NOW),
    logger,
  };
  return {
    getMyInvite: new GetMyInviteUseCase(shared),
    rotateInviteCode: new RotateInviteCodeUseCase(shared),
    inviteRepository,
    inviteRedemptionRepository,
    rewardGrantRepository,
    mutationLock,
    logger,
  };
}

describe("GetMyInviteUseCase·RotateInviteCodeUseCase — 내 초대", () => {
  it("처음 조회하면 초대 잠금 안에서 코드를 발급하고 다음 조회는 같은 코드를 준다", async () => {
    // Given
    const { getMyInvite, mutationLock } = createMyInviteUseCases();

    // When
    const first = await getMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });
    const second = await getMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // Then
    expect(first).toEqual({
      code: "K7M2QX",
      waitingCount: 0,
      qualifiedCount: 0,
      premiumDaysInWindow: 0,
      totalPremiumDays: 0,
      premiumCapState: "AVAILABLE",
      nextMilestone: {
        qualifiedCount: 1,
        rewards: [
          { rewardType: "PREMIUM_DAYS", quantity: 7 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      },
      rewardsEarned: [],
      createdAt: NOW,
    });
    expect(second).toEqual(first);
    expect(mutationLock.acquiredKeys).toEqual([[InviteLockKeys.invite(INVITER_ID)]]);
  });

  it("요약은 대기·사용 시작 인원과 적용된 보상만 받은 보상으로 센다", async () => {
    // Given
    const { getMyInvite, inviteRepository, inviteRedemptionRepository, rewardGrantRepository } =
      createMyInviteUseCases();
    await inviteRepository.add(createInviteFixture());
    for (const [index, status] of (["JOINED", "QUALIFIED", "REWARDED"] as const).entries()) {
      await inviteRedemptionRepository.add(
        createInviteRedemptionFixture({
          id: `c0000000000000000000rdm0${index}`,
          inviteeId: inviteFixtureInviteeId(index),
          status,
        }),
      );
    }
    await rewardGrantRepository.addAll([
      createRewardGrantFixture({ status: "APPLIED", createdAt: NOW }),
      createRewardGrantFixture({
        id: "c0000000000000000000grt02",
        rewardType: "FRIEND_SLOT",
        quantity: 1,
        createdAt: NOW,
      }),
    ]);

    // When
    const myInvite = await getMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // Then
    expect(myInvite).toMatchObject({
      waitingCount: 1,
      qualifiedCount: 2,
      premiumDaysInWindow: 7,
      totalPremiumDays: 7,
      rewardsEarned: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
      nextMilestone: { qualifiedCount: 3 },
    });
  });

  it("재발급하면 지금 코드를 폐기하고 새 코드를 발급한다", async () => {
    // Given
    const { getMyInvite, rotateInviteCode, inviteRepository } = createMyInviteUseCases();
    await getMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // When
    const rotated = await rotateInviteCode.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // Then
    expect(rotated).toMatchObject({ code: "B2C3D4", createdAt: NOW });
    const revoked = await inviteRepository.findByCodeWithInviter(InviteCode.create("K7M2QX"));
    expect(revoked?.invite.toPrimitives()).toMatchObject({ status: "REVOKED", revokedAt: NOW });
    expect((await inviteRepository.findActiveByInviterId(INVITER_ID))?.code.value).toBe("B2C3D4");
  });

  it("기능이 꺼져 있으면 발급하지 않고 INVITE_2105다", async () => {
    // Given
    const { getMyInvite, rotateInviteCode, inviteRepository } = createMyInviteUseCases({
      isEnabled: false,
    });

    // When
    const results = [
      getMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID }),
      rotateInviteCode.execute({ inviterId: INVITE_FIXTURE_INVITER_ID }),
    ];

    // Then
    for (const result of results) {
      await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.INVITE_2105 });
    }
    expect(inviteRepository.size).toBe(0);
  });
});
