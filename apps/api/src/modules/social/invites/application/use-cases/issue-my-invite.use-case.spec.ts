import { ErrorCode } from "@aido/api/errors";

import { SummarizeInviterProgressUseCase } from "#api/modules/social/invite-redemptions/application/use-cases/summarize-inviter-progress.use-case";
import { InviterProgressReaderAdapter } from "#api/modules/social/invite-redemptions/infrastructure/adapters/inviter-progress-reader.adapter";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionReader } from "#test/doubles/social/in-memory-invite-redemption.reader";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { StubInviteCodeGenerator } from "#test/doubles/social/stub-invite-code-generator";
import {
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
} from "#test/fixtures/social/invite.fixture";

import { InviteLockKeys } from "../invites.lock-keys.js";
import { IssueInviteCodeUseCase } from "./issue-invite-code.use-case.js";
import { IssueMyInviteUseCase } from "./issue-my-invite.use-case.js";
import { RotateInviteCodeUseCase } from "./rotate-invite-code.use-case.js";
import { SummarizeMyInviteUseCase } from "./summarize-my-invite.use-case.js";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const NOW = INVITE_FIXTURE_NOW.add({ hours: 1 });

function createMyInviteUseCases(
  options: { readonly isEnabled?: boolean; readonly codes?: readonly string[] } = {},
) {
  const inviteRepository = new InMemoryInviteRepository();
  const inviteRedemptionReader = new InMemoryInviteRedemptionReader(
    new InMemoryInviteRedemptionRepository(),
    new InMemoryRewardGrantRepository(),
  );
  const mutationLock = new RecordingMutationLock();
  const logger = new SilentLogger();
  const shared = {
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    inviteRepository,
    issueInviteCode: new IssueInviteCodeUseCase({
      inviteRepository,
      codeGenerator: new StubInviteCodeGenerator(options.codes ?? ["K7M2QX", "B2C3D4"]),
    }),
    summarizeMyInvite: new SummarizeMyInviteUseCase({
      inviterProgressReader: new InviterProgressReaderAdapter(
        new SummarizeInviterProgressUseCase({ inviteRedemptionReader }),
      ),
    }),
    inviteConfig: { isEnabled: options.isEnabled ?? true },
    clock: new FixedClock(NOW),
    logger,
  };
  return {
    issueMyInvite: new IssueMyInviteUseCase(shared),
    rotateInviteCode: new RotateInviteCodeUseCase(shared),
    inviteRepository,
    mutationLock,
    logger,
  };
}

describe("IssueMyInviteUseCase·RotateInviteCodeUseCase — 내 초대", () => {
  it("처음 조회하면 초대 잠금 안에서 코드를 발급하고 다음 조회는 같은 코드를 준다", async () => {
    // Given
    const { issueMyInvite, mutationLock } = createMyInviteUseCases();

    // When
    const first = await issueMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });
    const second = await issueMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

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

  it("재발급하면 지금 코드를 폐기하고 새 코드를 발급한다", async () => {
    // Given
    const { issueMyInvite, rotateInviteCode, inviteRepository } = createMyInviteUseCases();
    await issueMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // When
    const rotated = await rotateInviteCode.execute({ inviterId: INVITE_FIXTURE_INVITER_ID });

    // Then
    expect(rotated).toMatchObject({ code: "B2C3D4", createdAt: NOW });
    const revoked = inviteRepository.listAll().find((invite) => invite.code.value === "K7M2QX");
    expect(revoked?.toPrimitives()).toMatchObject({ status: "REVOKED", revokedAt: NOW });
    expect((await inviteRepository.findActiveByInviterId(INVITER_ID))?.code.value).toBe("B2C3D4");
  });

  it("기능이 꺼져 있으면 발급하지 않고 INVITE_2105다", async () => {
    // Given
    const { issueMyInvite, rotateInviteCode, inviteRepository } = createMyInviteUseCases({
      isEnabled: false,
    });

    // When
    const results = [
      issueMyInvite.execute({ inviterId: INVITE_FIXTURE_INVITER_ID }),
      rotateInviteCode.execute({ inviterId: INVITE_FIXTURE_INVITER_ID }),
    ];

    // Then
    for (const result of results) {
      await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.INVITE_2105 });
    }
    expect(inviteRepository.size).toBe(0);
  });
});
