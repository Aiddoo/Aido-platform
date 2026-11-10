import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { RecordingInviteNotifier } from "#test/doubles/social/recording-invite-notifier";
import { StubFollowReader } from "#test/doubles/social/stub-follow-reader";
import { StubInviteUserReader } from "#test/doubles/social/stub-invite-user-reader";
import { StubUserBlockReader } from "#test/doubles/social/stub-user-block-reader";
import {
  activeDaysOf,
  createInviteRedemptionFixture,
  INVITE_REDEMPTION_FIXTURE_ID,
} from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER,
  INVITE_FIXTURE_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { CheckInvitePairReachabilityUseCase } from "./check-invite-pair-reachability.use-case.js";
import { SendInviteQualifyReminderUseCase } from "./send-invite-qualify-reminder.use-case.js";

// 2028-03-02 18:00 KST
const NOW = Temporal.Instant.from("2028-03-02T09:00:00Z");
const REDEMPTION_ID = InviteRedemptionId.reconstitute(INVITE_REDEMPTION_FIXTURE_ID);

function dueRedemption(overrides: Parameters<typeof createInviteRedemptionFixture>[0] = {}) {
  return createInviteRedemptionFixture({
    joinedAt: Temporal.Instant.from("2028-02-18T03:00:00Z"),
    activeDays: activeDaysOf("2028-02-25"),
    expiresAt: Temporal.Instant.from("2028-03-04T03:00:00Z"),
    ...overrides,
  });
}

function createSender(
  options: {
    readonly redemptions?: ReturnType<typeof dueRedemption>[];
    readonly isQuiet?: boolean;
    readonly areFriends?: boolean;
    readonly isEnabled?: boolean;
  } = {},
) {
  const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository(
    options.redemptions ?? [dueRedemption()],
  );
  const notifier = new RecordingInviteNotifier();
  if (options.isQuiet === true) {
    notifier.quietUserIds.add(INVITE_FIXTURE_INVITEE_ID);
  }
  const followReader = new StubFollowReader();
  if (options.areFriends !== false) {
    followReader.addMutual(INVITE_FIXTURE_INVITEE_ID, INVITE_FIXTURE_INVITER_ID);
  }
  const blockReader = new StubUserBlockReader();
  const userReader = new StubInviteUserReader();
  const useCase = new SendInviteQualifyReminderUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    inviteRedemptionRepository,
    userReader,
    pairReachability: new CheckInvitePairReachabilityUseCase({ followReader, blockReader }),
    notifier,
    inviteConfig: { isEnabled: options.isEnabled ?? true },
    logger: new SilentLogger(),
  });
  const sentAt = async () =>
    (await inviteRedemptionRepository.findByIdForUpdate(REDEMPTION_ID))?.qualifyReminderSentAt ??
    null;
  return { useCase, notifier, blockReader, userReader, sentAt };
}

describe("SendInviteQualifyReminderUseCase — 사용 시작 알림 발송", () => {
  it("하루만 더 남은 초대받은 사람에게 초대한 사람 이름으로 한 번 보내고 발송을 표시한다", async () => {
    // Given
    const { useCase, notifier, sentAt } = createSender();

    // When
    const first = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });
    const rerun = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });

    // Then
    expect(first).toEqual({ status: "sent" });
    expect(rerun).toEqual({ status: "skipped", reason: "not-due" });
    expect(notifier.qualifyReminders).toEqual([
      {
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        inviterName: INVITE_FIXTURE_INVITER.name,
        redemptionId: INVITE_REDEMPTION_FIXTURE_ID,
      },
    ]);
    expect(await sentAt()).toEqual(NOW);
  });

  it.each([
    { label: "친구를 끊음", arrange: () => createSender({ areFriends: false }) },
    {
      label: "초대한 사람을 차단함",
      arrange: () => {
        const sender = createSender();
        sender.blockReader.block(INVITE_FIXTURE_INVITEE_ID, INVITE_FIXTURE_INVITER_ID);
        return sender;
      },
    },
    {
      label: "초대한 사람이 차단함",
      arrange: () => {
        const sender = createSender();
        sender.blockReader.block(INVITE_FIXTURE_INVITER_ID, INVITE_FIXTURE_INVITEE_ID);
        return sender;
      },
    },
    {
      label: "초대한 사람이 탈퇴 처리됨",
      arrange: () => {
        const sender = createSender();
        sender.userReader.withdraw(INVITE_FIXTURE_INVITER_ID);
        return sender;
      },
    },
  ])("$label이면 보내지 않고 표시도 남기지 않는다", async ({ arrange }) => {
    // Given
    const { useCase, notifier, sentAt } = arrange();

    // When
    const result = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "unreachable" });
    expect(notifier.qualifyReminders).toEqual([]);
    expect(await sentAt()).toBeNull();
  });

  it.each([
    { label: "수락이 사라짐", redemptions: [] },
    { label: "그 사이 사용 시작함", redemptions: [dueRedemption({ status: "QUALIFIED" })] },
    { label: "만료로 거절됨", redemptions: [dueRedemption({ status: "REJECTED" })] },
    { label: "초대한 사람 행이 지워짐", redemptions: [dueRedemption({ inviterId: null })] },
  ])("$label이면 보내지 않는다", async ({ redemptions }) => {
    // Given
    const { useCase, notifier } = createSender({ redemptions });

    // When
    const result = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "not-due" });
    expect(notifier.qualifyReminders).toEqual([]);
  });

  it("작업이 늦어 야간이면 표시하지 않고 다음 정비 실행이 다시 예약하게 둔다", async () => {
    // Given
    const { useCase, notifier, sentAt } = createSender({ isQuiet: true });

    // When
    const result = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "quiet-hours" });
    expect(notifier.qualifyReminders).toEqual([]);
    expect(await sentAt()).toBeNull();
  });

  it("기능이 꺼져 있으면 수락을 읽지 않고 건너뛴다", async () => {
    // Given
    const { useCase, notifier } = createSender({ isEnabled: false });

    // When
    const result = await useCase.execute({ redemptionId: INVITE_REDEMPTION_FIXTURE_ID, now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "disabled" });
    expect(notifier.qualifyReminders).toEqual([]);
  });
});
