import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import {
  InviteRedemption,
  type InviteRedemptionProps,
} from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";
import type { UserBlockRelation } from "../../ports/blocks/user-block-reader.port.js";
import type { InviteQualifyReminderNotification } from "../../ports/invites/invite-notifier.port.js";
import { SendInviteQualifyReminder } from "./send-invite-qualify-reminder.use-case.js";

// 2028-03-02 18:00 KST
const NOW = new Date("2028-03-02T09:00:00.000Z");
const NO_BLOCK: UserBlockRelation = { isBlocking: false, isBlockedBy: false };

function redemptionProps(overrides: Partial<InviteRedemptionProps> = {}): InviteRedemptionProps {
  return {
    id: "redemption-1",
    inviteId: "invite-1",
    inviterId: "inviter-1",
    inviteeId: "invitee-1",
    status: "JOINED",
    rejectionReason: null,
    timezone: "Asia/Seoul",
    inviterRewardEligible: true,
    activeDays: ["2028-02-25"],
    joinedAt: new Date("2028-02-18T03:00:00.000Z"),
    qualifiedAt: null,
    rewardedAt: null,
    rejectedAt: null,
    expiresAt: new Date("2028-03-04T03:00:00.000Z"),
    qualifyReminderSentAt: null,
    ...overrides,
  };
}

function createSender({
  props = redemptionProps(),
  areFriends = true,
  blockRelation = NO_BLOCK,
  isQuiet = false,
  inviterName = "매튜",
}: {
  props?: InviteRedemptionProps | null;
  areFriends?: boolean;
  blockRelation?: UserBlockRelation;
  isQuiet?: boolean;
  inviterName?: string | null;
} = {}) {
  let stored = props;
  const notified: InviteQualifyReminderNotification[] = [];
  const sender = new SendInviteQualifyReminder({
    inviteRedemptionRepository: {
      findByIdForUpdate: async () =>
        stored == null ? null : InviteRedemption.reconstitute(stored),
      save: async (redemption) => {
        if (stored == null) return;
        stored = { ...stored, qualifyReminderSentAt: redemption.qualifyReminderSentAt };
      },
      findDisplayName: async () => inviterName,
    },
    notifier: {
      notifyQualifyReminder: async (notification) => {
        notified.push(notification);
      },
      isInQuietHours: async () => isQuiet,
    },
    followReader: { isCurrentMutualFriend: async () => areFriends },
    blockReader: { findRelation: async () => blockRelation },
    inviteConfig: { isEnabled: true },
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLogger>(),
  });
  return { sender, notified, sentAt: () => stored?.qualifyReminderSentAt ?? null };
}

describe("SendInviteQualifyReminder", () => {
  it("하루만 더 남은 초대받은 사람에게 초대한 사람 이름으로 한 번 보내고 발송을 표시한다", async () => {
    // Given
    const { sender, notified, sentAt } = createSender();

    // When
    const first = await sender.execute({ redemptionId: "redemption-1", now: NOW });
    const rerun = await sender.execute({ redemptionId: "redemption-1", now: NOW });

    // Then
    expect(first).toEqual({ status: "sent" });
    expect(rerun).toEqual({ status: "skipped", reason: "not-due" });
    expect(notified).toEqual([
      { inviteeId: "invitee-1", inviterName: "매튜", redemptionId: "redemption-1" },
    ]);
    expect(sentAt()).toEqual(NOW);
  });

  it.each([
    { label: "친구를 끊음", options: { areFriends: false } },
    {
      label: "초대한 사람을 차단함",
      options: { blockRelation: { ...NO_BLOCK, isBlocking: true } },
    },
    {
      label: "초대한 사람이 차단함",
      options: { blockRelation: { ...NO_BLOCK, isBlockedBy: true } },
    },
    { label: "초대한 사람이 탈퇴 처리됨", options: { inviterName: null } },
  ])("$label이면 보내지 않고 표시도 남기지 않는다", async ({ options }) => {
    // Given
    const { sender, notified, sentAt } = createSender(options);

    // When
    const result = await sender.execute({ redemptionId: "redemption-1", now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "unreachable" });
    expect(notified).toEqual([]);
    expect(sentAt()).toBeNull();
  });

  it.each([
    { label: "수락이 사라짐", props: null },
    { label: "그 사이 사용 시작함", props: redemptionProps({ status: "QUALIFIED" }) },
    { label: "만료로 거절됨", props: redemptionProps({ status: "REJECTED" }) },
    { label: "초대한 사람 행이 지워짐", props: redemptionProps({ inviterId: null }) },
  ])("$label이면 보내지 않는다", async ({ props }) => {
    // Given
    const { sender, notified } = createSender({ props });

    // When
    const result = await sender.execute({ redemptionId: "redemption-1", now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "not-due" });
    expect(notified).toEqual([]);
  });

  it("작업이 늦어 야간이면 표시하지 않고 다음 정비 실행이 다시 예약하게 둔다", async () => {
    // Given
    const { sender, notified, sentAt } = createSender({ isQuiet: true });

    // When
    const result = await sender.execute({ redemptionId: "redemption-1", now: NOW });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "quiet-hours" });
    expect(notified).toEqual([]);
    expect(sentAt()).toBeNull();
  });
});
