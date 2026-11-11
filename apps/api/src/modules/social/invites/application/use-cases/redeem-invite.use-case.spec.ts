import { ErrorCode } from "@aido/api/errors";

import { FriendLockKeys } from "#api/modules/social/friends/application/friends.lock-keys";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeClaimHasher } from "#test/doubles/social/fake-claim-hasher";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";
import { InMemoryRewardClaimRepository } from "#test/doubles/social/in-memory-reward-claim.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { RecordingInviteNotifier } from "#test/doubles/social/recording-invite-notifier";
import { RecordingInviteRewardScheduler } from "#test/doubles/social/recording-invite-reward-scheduler";
import { RecordingRewardApplier } from "#test/doubles/social/recording-reward-applier";
import { StubFollowReader } from "#test/doubles/social/stub-follow-reader";
import { StubFriendshipEstablisher } from "#test/doubles/social/stub-friendship-establisher";
import { StubInviteUserReader } from "#test/doubles/social/stub-invite-user-reader";
import { StubUserBlockReader } from "#test/doubles/social/stub-user-block-reader";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITEE,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";
import { createRewardClaimFixture } from "#test/fixtures/social/reward-claim.fixture";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteLockKeys } from "../invites.lock-keys.js";
import { RedeemInviteUseCase } from "./redeem-invite.use-case.js";

const NOW = INVITE_FIXTURE_NOW.add({ hours: 1 });
const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const INVITEE_ID = UserId.reconstitute(INVITE_FIXTURE_INVITEE_ID);
const INVITER = {
  userId: INVITE_FIXTURE_INVITER.id,
  name: INVITE_FIXTURE_INVITER.name,
  userTag: INVITE_FIXTURE_INVITER.userTag,
  profileImage: INVITE_FIXTURE_INVITER.profileImage,
};
const COMMAND = {
  inviteeId: INVITE_FIXTURE_INVITEE_ID,
  code: "k7m2-qx",
  installationId: "6F9619FF-8B86",
  timezone: "Asia/Seoul",
};

function createRedeemer(options: { readonly isEnabled?: boolean } = {}) {
  const inviteRepository = new InMemoryInviteRepository([createInviteFixture()]);
  const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository();
  const rewardClaimRepository = new InMemoryRewardClaimRepository();
  const rewardGrantRepository = new InMemoryRewardGrantRepository();
  const userReader = new StubInviteUserReader();
  const rewardApplier = new RecordingRewardApplier();
  const followReader = new StubFollowReader();
  const blockReader = new StubUserBlockReader();
  const friendshipEstablisher = new StubFriendshipEstablisher();
  const notifier = new RecordingInviteNotifier();
  const rewardScheduler = new RecordingInviteRewardScheduler();
  const mutationLock = new RecordingMutationLock();
  const useCase = new RedeemInviteUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    inviteRepository,
    inviteRedemptionRepository,
    rewardClaimRepository,
    rewardGrantRepository,
    userReader,
    rewardApplier,
    followReader,
    blockReader,
    friendshipEstablisher,
    claimHasher: new FakeClaimHasher(),
    notifier,
    rewardScheduler,
    inviteConfig: { isEnabled: options.isEnabled ?? true },
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return {
    useCase,
    inviteRepository,
    inviteRedemptionRepository,
    rewardClaimRepository,
    rewardGrantRepository,
    userReader,
    rewardApplier,
    followReader,
    blockReader,
    friendshipEstablisher,
    notifier,
    rewardScheduler,
    mutationLock,
  };
}

describe("RedeemInviteUseCase — 초대 수락", () => {
  it("새 사용자는 잠금 안에서 수락을 남기고 친구를 맺고 프리미엄 7일을 바로 적용한 뒤 초대한 사람에게 알린다", async () => {
    // Given
    const redeemer = createRedeemer();

    // When
    const result = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(result).toEqual({
      outcome: "REDEEMED",
      inviter: INVITER,
      friendship: "FRIENDS",
      rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
      redemptionId: expect.any(String),
      isReplay: false,
    });
    expect(redeemer.mutationLock.acquiredKeys).toEqual([
      [
        InviteLockKeys.invite(INVITER_ID),
        FriendLockKeys.pair(INVITER_ID, INVITEE_ID),
        FriendLockKeys.list(INVITER_ID),
        FriendLockKeys.list(INVITEE_ID),
      ],
    ]);
    const redemption =
      await redeemer.inviteRedemptionRepository.findByInviteeIdForUpdate(INVITEE_ID);
    expect(redemption?.toPrimitives()).toMatchObject({
      inviterId: INVITE_FIXTURE_INVITER_ID,
      status: "JOINED",
      timezone: "Asia/Seoul",
      inviterRewardEligible: true,
      joinedAt: NOW,
    });
    const grants = await redeemer.rewardGrantRepository.listByRedemptionId(
      InviteRedemptionId.reconstitute(result.outcome === "REDEEMED" ? result.redemptionId : ""),
    );
    expect(grants.map((grant) => [grant.recipientId.value, grant.status])).toEqual([
      [INVITE_FIXTURE_INVITEE_ID, "APPLIED"],
    ]);
    expect(redeemer.rewardApplier.applied.map((grant) => grant.rewardType)).toEqual([
      "PREMIUM_DAYS",
    ]);
    expect(redeemer.rewardScheduler.scheduled).toEqual([]);
    expect(redeemer.rewardClaimRepository.size).toBe(2);
    expect(redeemer.friendshipEstablisher.requests).toEqual([
      {
        requesterId: INVITEE_ID,
        targetUserId: INVITER_ID,
        shouldNotifyFriends: false,
      },
    ]);
    expect(redeemer.notifier.joined).toEqual([
      {
        inviterId: INVITE_FIXTURE_INVITER_ID,
        inviteeName: INVITE_FIXTURE_INVITEE.name,
        redemptionId: result.outcome === "REDEEMED" ? result.redemptionId : null,
      },
    ]);
  });

  it("응답을 놓쳐 같은 초대를 다시 누르면 처음 결과를 다시 돌려주고 보상·알림을 더 만들지 않는다", async () => {
    // Given
    const redeemer = createRedeemer();
    const first = await redeemer.useCase.execute(COMMAND);

    // When
    const replay = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(replay).toEqual({ ...first, isReplay: true });
    expect(redeemer.rewardApplier.applied).toHaveLength(1);
    expect(redeemer.notifier.joined).toHaveLength(1);
  });

  it("같은 기기로 이미 보상을 받았으면 친구는 맺되 양쪽 보상을 남기지 않는다", async () => {
    // Given
    const redeemer = createRedeemer();
    const claimHash = new FakeClaimHasher().hash({
      claimKind: "INSTALLATION",
      value: COMMAND.installationId,
    });
    await redeemer.rewardClaimRepository.claimAll([createRewardClaimFixture({ claimHash })], NOW);

    // When
    const result = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(result).toMatchObject({ outcome: "REDEEMED", rewards: [], friendship: "FRIENDS" });
    const redemption =
      await redeemer.inviteRedemptionRepository.findByInviteeIdForUpdate(INVITEE_ID);
    expect(redemption?.inviterRewardEligible).toBe(false);
    expect(redeemer.rewardGrantRepository.size).toBe(0);
  });

  it("가입한 지 7일이 지난 사용자는 보상 없이 친구만 맺는다", async () => {
    // Given
    const redeemer = createRedeemer();
    redeemer.userReader.setIdentity({
      userId: INVITE_FIXTURE_INVITEE_ID,
      displayName: "친구1",
      joinedAt: NOW.subtract({ hours: 7 * 24 }),
      verifiedEmail: null,
      providerAccounts: [],
    });
    redeemer.friendshipEstablisher.result = "REQUESTED";

    // When
    const result = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(result).toEqual({ outcome: "CONNECTED", inviter: INVITER, friendship: "REQUESTED" });
    expect(redeemer.inviteRedemptionRepository.size).toBe(0);
    expect(redeemer.friendshipEstablisher.requests[0]?.shouldNotifyFriends).toBe(true);
  });

  it("이미 친구면 아무것도 바꾸지 않고 ALREADY_FRIENDS다", async () => {
    // Given
    const redeemer = createRedeemer();
    redeemer.followReader.addMutual(INVITE_FIXTURE_INVITEE_ID, INVITE_FIXTURE_INVITER_ID);

    // When
    const result = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(result).toEqual({ outcome: "ALREADY_FRIENDS", inviter: INVITER });
    expect(redeemer.friendshipEstablisher.requests).toEqual([]);
  });

  it("초대 알림이 실패해도 수락은 성공으로 끝난다", async () => {
    // Given
    const redeemer = createRedeemer();
    redeemer.notifier.isDown = true;

    // When
    const result = await redeemer.useCase.execute(COMMAND);

    // Then
    expect(result).toMatchObject({ outcome: "REDEEMED", isReplay: false });
  });

  it.each([
    {
      name: "기능이 꺼짐(형식이 틀린 코드보다 먼저)",
      arrange: () => createRedeemer({ isEnabled: false }),
      command: { ...COMMAND, code: "K7M2Q0" },
      expected: { errorCode: ErrorCode.INVITE_2105 },
    },
    {
      name: "형식이 틀린 코드(사용자 확인보다 먼저)",
      arrange: () => {
        const redeemer = createRedeemer();
        redeemer.userReader.remove(INVITE_FIXTURE_INVITEE_ID);
        return redeemer;
      },
      command: { ...COMMAND, code: "K7M2Q0" },
      expected: { errorCode: ErrorCode.SYS_0002 },
    },
    {
      name: "없는 사용자",
      arrange: () => {
        const redeemer = createRedeemer();
        redeemer.userReader.remove(INVITE_FIXTURE_INVITEE_ID);
        return redeemer;
      },
      command: COMMAND,
      expected: { errorCode: ErrorCode.USER_0601, details: { userId: INVITE_FIXTURE_INVITEE_ID } },
    },
    {
      name: "없는 코드",
      arrange: () => createRedeemer(),
      command: { ...COMMAND, code: "B2C3D4" },
      expected: { errorCode: ErrorCode.INVITE_2101 },
    },
    {
      name: "자기 초대",
      arrange: () => createRedeemer(),
      command: { ...COMMAND, inviteeId: INVITE_FIXTURE_INVITER_ID },
      expected: { errorCode: ErrorCode.INVITE_2103 },
    },
    {
      name: "초대한 사람이 나를 차단함",
      arrange: () => {
        const redeemer = createRedeemer();
        redeemer.blockReader.block(INVITE_FIXTURE_INVITER_ID, INVITE_FIXTURE_INVITEE_ID);
        return redeemer;
      },
      command: COMMAND,
      expected: { errorCode: ErrorCode.BLOCK_2204 },
    },
    {
      name: "폐기된 코드",
      arrange: async () => {
        const redeemer = createRedeemer();
        const invite = createInviteFixture();
        invite.revoke(NOW);
        await redeemer.inviteRepository.save(invite);
        return redeemer;
      },
      command: COMMAND,
      expected: { errorCode: ErrorCode.INVITE_2102 },
    },
    {
      name: "이미 다른 초대를 수락함",
      arrange: async () => {
        const redeemer = createRedeemer();
        await redeemer.inviteRedemptionRepository.add(
          createInviteRedemptionFixture({ inviterId: INVITE_FIXTURE_OTHER_INVITER_ID }),
        );
        return redeemer;
      },
      command: COMMAND,
      expected: { errorCode: ErrorCode.INVITE_2104 },
    },
    {
      name: "내 친구 자리가 꽉 참",
      arrange: () => {
        const redeemer = createRedeemer();
        redeemer.friendshipEstablisher.result = "UNAVAILABLE";
        return redeemer;
      },
      command: COMMAND,
      expected: { errorCode: ErrorCode.INVITE_2106 },
    },
  ])("$name이면 거절한다", async ({ arrange, command, expected }) => {
    // Given
    const redeemer = await arrange();

    // When
    const result = redeemer.useCase.execute(command);

    // Then
    await expect(result).rejects.toMatchObject(expected);
    expect(redeemer.notifier.joined).toEqual([]);
  });
});
