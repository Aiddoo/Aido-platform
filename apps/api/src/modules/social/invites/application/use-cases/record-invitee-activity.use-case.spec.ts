import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { RecordingInviteNotifier } from "#test/doubles/social/recording-invite-notifier";
import { RecordingInviteRewardScheduler } from "#test/doubles/social/recording-invite-reward-scheduler";
import { StubInviteUserReader } from "#test/doubles/social/stub-invite-user-reader";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import { StubUserBlockReader } from "#test/doubles/social/stub-user-block-reader";
import {
  activeDaysOf,
  createInviteRedemptionFixture,
  INVITE_REDEMPTION_FIXTURE_ID,
} from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITEE,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteLockKeys } from "../invites.lock-keys.js";
import { CheckInvitePairReachabilityUseCase } from "./check-invite-pair-reachability.use-case.js";
import {
  type RecordInviteeActivityDependencies,
  RecordInviteeActivityUseCase,
} from "./record-invitee-activity.use-case.js";

// 2028-03-02 12:00 KST
const FIRST_DAY = Temporal.Instant.from("2028-03-02T03:00:00Z");
const SECOND_DAY = Temporal.Instant.from("2028-03-03T03:00:00Z");
const PROCESSED_AT = SECOND_DAY.add({ minutes: 1 });
const REDEMPTION_ID = InviteRedemptionId.reconstitute(INVITE_REDEMPTION_FIXTURE_ID);
const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);

function joinedRedemption(overrides: Parameters<typeof createInviteRedemptionFixture>[0] = {}) {
  return createInviteRedemptionFixture({
    joinedAt: Temporal.Instant.from("2028-03-01T03:00:00Z"),
    expiresAt: Temporal.Instant.from("2028-03-15T03:00:00Z"),
    ...overrides,
  });
}

function createRecorder(
  options: {
    readonly redemption?: ReturnType<typeof joinedRedemption>;
    readonly overrides?: Partial<RecordInviteeActivityDependencies>;
    readonly areFriends?: boolean;
  } = {},
) {
  const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository([
    options.redemption ?? joinedRedemption(),
  ]);
  const rewardGrantRepository = new InMemoryRewardGrantRepository();
  const rewardScheduler = new RecordingInviteRewardScheduler();
  const notifier = new RecordingInviteNotifier();
  const mutationLock = new RecordingMutationLock();
  const mutualFriendReader = new StubMutualFriendReader();
  if (options.areFriends !== false) {
    mutualFriendReader.addMutual(INVITE_FIXTURE_INVITEE_ID, INVITE_FIXTURE_INVITER_ID);
  }
  const blockReader = new StubUserBlockReader();
  const useCase = new RecordInviteeActivityUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    inviteRedemptionRepository,
    rewardGrantRepository,
    userReader: new StubInviteUserReader(),
    pairReachability: new CheckInvitePairReachabilityUseCase({ mutualFriendReader, blockReader }),
    rewardScheduler,
    notifier,
    inviteConfig: { isEnabled: true },
    clock: new FixedClock(PROCESSED_AT),
    logger: new SilentLogger(),
    ...options.overrides,
  });
  return {
    useCase,
    inviteRedemptionRepository,
    rewardGrantRepository,
    rewardScheduler,
    notifier,
    mutationLock,
    blockReader,
  };
}

describe("RecordInviteeActivityUseCase — 초대받은 사람 활동일 기록", () => {
  describe("첫날 알림", () => {
    it("초대받은 사람이 처음 할 일을 끝내면 초대한 사람에게 이름과 함께 한 번 알린다", async () => {
      // Given
      const { useCase, notifier } = createRecorder();

      // When
      const result = await useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: FIRST_DAY,
      });

      // Then
      expect(result).toEqual({ status: "recorded" });
      expect(notifier.progress).toEqual([
        {
          inviterId: INVITE_FIXTURE_INVITER_ID,
          inviteeName: INVITE_FIXTURE_INVITEE.name,
          redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
        },
      ]);
    });

    it("같은 날 할 일을 또 끝내면 다시 알리지 않는다", async () => {
      // Given
      const { useCase, notifier } = createRecorder();
      await useCase.execute({ inviteeId: INVITE_FIXTURE_INVITEE_ID, occurredAt: FIRST_DAY });

      // When
      const result = await useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: FIRST_DAY.add({ hours: 7 }),
      });

      // Then
      expect(result).toEqual({ status: "skipped" });
      expect(notifier.progress).toHaveLength(1);
    });

    it.each([
      { label: "친구를 끊음", arrange: () => createRecorder({ areFriends: false }) },
      {
        label: "초대한 사람을 차단함",
        arrange: () => {
          const recorder = createRecorder();
          recorder.blockReader.block(INVITE_FIXTURE_INVITEE_ID, INVITE_FIXTURE_INVITER_ID);
          return recorder;
        },
      },
      {
        label: "초대한 사람이 차단함",
        arrange: () => {
          const recorder = createRecorder();
          recorder.blockReader.block(INVITE_FIXTURE_INVITER_ID, INVITE_FIXTURE_INVITEE_ID);
          return recorder;
        },
      },
      {
        label: "초대 기능이 꺼짐",
        arrange: () => createRecorder({ overrides: { inviteConfig: { isEnabled: false } } }),
      },
      {
        label: "초대한 사람이 탈퇴함",
        arrange: () => createRecorder({ redemption: joinedRedemption({ inviterId: null }) }),
      },
    ])("$label이면 첫날을 기록하되 알리지 않는다", async ({ arrange }) => {
      // Given
      const { useCase, notifier, inviteRedemptionRepository } = arrange();

      // When
      const result = await useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: FIRST_DAY,
      });

      // Then
      expect(result).toEqual({ status: "recorded" });
      expect(notifier.progress).toEqual([]);
      const saved = await inviteRedemptionRepository.findByIdForUpdate(REDEMPTION_ID);
      expect(saved?.activeDays.map(String)).toEqual(["2028-03-02"]);
    });

    it("알림이 실패해도 활동일 기록은 성공으로 끝난다", async () => {
      // Given
      const recorder = createRecorder();
      recorder.notifier.isDown = true;

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: FIRST_DAY,
      });

      // Then
      expect(result).toEqual({ status: "recorded" });
    });
  });

  describe("사용 시작", () => {
    it("둘째 날은 사용 시작으로 바꾸고 원장 잠금 안에서 초대한 사람 보상을 남겨 지급 작업을 만든다", async () => {
      // Given
      const recorder = createRecorder({
        redemption: joinedRedemption({ activeDays: activeDaysOf("2028-03-02") }),
      });

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: SECOND_DAY,
      });

      // Then
      expect(result).toEqual({
        status: "qualified",
        redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
        grantCount: 2,
      });
      expect(recorder.notifier.progress).toEqual([]);
      expect(recorder.mutationLock.acquiredKeys).toEqual([
        [InviteLockKeys.rewardLedger(INVITER_ID)],
      ]);
      const saved = await recorder.inviteRedemptionRepository.findByIdForUpdate(REDEMPTION_ID);
      expect(saved?.toPrimitives()).toMatchObject({ status: "QUALIFIED", qualifiedAt: SECOND_DAY });
      const grants = await recorder.rewardGrantRepository.listByRedemptionId(REDEMPTION_ID);
      expect(
        grants.map((grant) => [grant.recipientId.value, grant.rewardType, grant.quantity]),
      ).toEqual(
        expect.arrayContaining([
          [INVITE_FIXTURE_INVITER_ID, "PREMIUM_DAYS", 7],
          [INVITE_FIXTURE_INVITER_ID, "FRIEND_SLOT", 1],
        ]),
      );
      expect(grants.every((grant) => grant.toPrimitives().createdAt.equals(PROCESSED_AT))).toBe(
        true,
      );
      expect(recorder.rewardScheduler.scheduled).toEqual([
        { redemptionId: INVITE_REDEMPTION_FIXTURE_ID, trigger: { kind: "qualified" } },
      ]);
    });

    it("최근 30일 프리미엄 상한을 다 쓴 초대한 사람도 사용 시작으로 인정하고 친구 자리만 남긴다", async () => {
      // Given
      const recorder = createRecorder({
        redemption: joinedRedemption({ activeDays: activeDaysOf("2028-03-02") }),
      });
      await recorder.rewardGrantRepository.addAll([
        createRewardGrantFixture({
          sourceId: "c0000000000000000000rdm0z",
          quantity: 30,
          status: "APPLIED",
          createdAt: FIRST_DAY,
        }),
      ]);

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: SECOND_DAY,
      });

      // Then
      expect(result).toMatchObject({ status: "qualified", grantCount: 1 });
      const grants = await recorder.rewardGrantRepository.listByRedemptionId(REDEMPTION_ID);
      expect(grants.map((grant) => [grant.rewardType, grant.quantity])).toEqual([
        ["FRIEND_SLOT", 1],
      ]);
    });

    it("같은 기기·신원으로 이미 보상을 받은 수락은 사용 시작해도 초대한 사람 보상을 만들지 않는다", async () => {
      // Given
      const recorder = createRecorder({
        redemption: joinedRedemption({
          activeDays: activeDaysOf("2028-03-02"),
          inviterRewardEligible: false,
        }),
      });

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: SECOND_DAY,
      });

      // Then
      expect(result).toMatchObject({ status: "qualified", grantCount: 0 });
      expect(await recorder.rewardGrantRepository.listByRedemptionId(REDEMPTION_ID)).toEqual([]);
    });

    it("기능이 꺼져 있으면 사용 시작과 원장만 남기고 지급 작업은 만들지 않는다", async () => {
      // Given
      const recorder = createRecorder({
        redemption: joinedRedemption({ activeDays: activeDaysOf("2028-03-02") }),
        overrides: { inviteConfig: { isEnabled: false } },
      });

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: SECOND_DAY,
      });

      // Then
      expect(result).toMatchObject({ status: "qualified", grantCount: 2 });
      expect(recorder.rewardScheduler.scheduled).toEqual([]);
    });

    it("JOINED 수락이 없는 사용자는 잠그지 않고 건너뛴다", async () => {
      // Given
      const recorder = createRecorder({
        redemption: joinedRedemption({ status: "QUALIFIED", qualifiedAt: FIRST_DAY }),
      });

      // When
      const result = await recorder.useCase.execute({
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        occurredAt: SECOND_DAY,
      });

      // Then
      expect(result).toEqual({ status: "skipped" });
      expect(recorder.mutationLock.acquiredKeys).toEqual([]);
    });
  });
});
