import {
  InviteRedemption,
  type InviteRedemptionProps,
} from "../../aggregates/invites/invite-redemption.aggregate.js";
import {
  InviteQualifyReminderPolicy,
  isFirstActiveDay,
  nextQualifyReminderAt,
} from "./invite-qualify-reminder.policy.js";

// 2028-03-02 12:00 KST
const NOW = new Date("2028-03-02T03:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function redemptionOf(overrides: Partial<InviteRedemptionProps> = {}): InviteRedemption {
  return InviteRedemption.reconstitute({
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
    expiresAt: new Date(NOW.getTime() + 3 * DAY_MS),
    qualifyReminderSentAt: null,
    ...overrides,
  });
}

describe("InviteQualifyReminderPolicy", () => {
  it.each([
    { label: "마감 3일 전", expiresInMs: 3 * DAY_MS, expected: true },
    { label: "마감 1시간 전", expiresInMs: 60 * 60 * 1000, expected: true },
    { label: "마감 3일 1분 전", expiresInMs: 3 * DAY_MS + 60 * 1000, expected: false },
    { label: "마감 4일 전", expiresInMs: 4 * DAY_MS, expected: false },
    { label: "마감이 지남", expiresInMs: 0, expected: false },
  ])("$label이면 알림 대상 여부는 $expected이다", ({ expiresInMs, expected }) => {
    // Given
    const redemption = redemptionOf({ expiresAt: new Date(NOW.getTime() + expiresInMs) });

    // When
    const isDue = InviteQualifyReminderPolicy.isDue(redemption, NOW);

    // Then
    expect(isDue).toBe(expected);
  });

  it.each([
    { activeDays: [], expected: false },
    { activeDays: ["2028-02-25"], expected: true },
    { activeDays: ["2028-02-25", "2028-02-26"], expected: false },
  ])("할 일을 끝낸 날이 $activeDays.length일이면 $expected이다", ({ activeDays, expected }) => {
    // Given
    const redemption = redemptionOf({ activeDays });

    // When
    const isDue = InviteQualifyReminderPolicy.isDue(redemption, NOW);

    // Then
    expect(isDue).toBe(expected);
  });

  it.each([
    { label: "이미 사용 시작", overrides: { status: "QUALIFIED" as const } },
    { label: "만료·거절", overrides: { status: "REJECTED" as const } },
    { label: "이미 알림을 보냄", overrides: { qualifyReminderSentAt: new Date(NOW) } },
    { label: "초대한 사람이 탈퇴", overrides: { inviterId: null } },
    { label: "초대한 사람 보상이 없는 수락", overrides: { inviterRewardEligible: false } },
    { label: "오늘 이미 할 일을 끝냄", overrides: { activeDays: ["2028-03-02"] } },
  ])("$label이면 보내지 않는다", ({ overrides }) => {
    // Given
    const redemption = redemptionOf(overrides);

    // When
    const isDue = InviteQualifyReminderPolicy.isDue(redemption, NOW);

    // Then
    expect(isDue).toBe(false);
  });

  it("발송 표시는 한 번만 바뀌어 다시 실행해도 대상이 아니다", () => {
    // Given
    const redemption = redemptionOf();

    // When
    const first = redemption.markQualifyReminderSent(NOW);
    const second = redemption.markQualifyReminderSent(NOW);

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(InviteQualifyReminderPolicy.isDue(redemption, NOW)).toBe(false);
  });
});

describe("nextQualifyReminderAt", () => {
  it.each([
    {
      label: "서울 새벽 정비 실행은 그날 18시",
      now: "2028-03-01T18:30:00.000Z",
      timezone: "Asia/Seoul",
      expected: "2028-03-02T09:00:00.000Z",
    },
    {
      label: "서울 18시가 지났으면 다음 날 18시",
      now: "2028-03-02T09:00:00.000Z",
      timezone: "Asia/Seoul",
      expected: "2028-03-03T09:00:00.000Z",
    },
    {
      label: "UTC로 고정된 시간대는 배송 기준대로 KST",
      now: "2028-03-01T18:30:00.000Z",
      timezone: "UTC",
      expected: "2028-03-02T09:00:00.000Z",
    },
    {
      label: "LA 서머타임 시작일에도 벽시계 18시",
      now: "2028-03-12T09:00:00.000Z",
      timezone: "America/Los_Angeles",
      expected: "2028-03-13T01:00:00.000Z",
    },
  ])("$label", ({ now, timezone, expected }) => {
    // When
    const sendAt = nextQualifyReminderAt(new Date(now), timezone);

    // Then
    expect(sendAt.toISOString()).toBe(expected);
  });
});

describe("isFirstActiveDay", () => {
  it("첫날을 기록하면 참이고 같은 날 다시 기록하거나 둘째 날을 기록하면 거짓이다", () => {
    // Given
    const redemption = redemptionOf({ activeDays: [] });

    // When
    const firstDay = redemption.recordActiveDay("2028-03-02", NOW) && isFirstActiveDay(redemption);
    const sameDay = redemption.recordActiveDay("2028-03-02", NOW);
    const secondDay =
      redemption.recordActiveDay("2028-03-03", new Date(NOW.getTime() + DAY_MS)) &&
      isFirstActiveDay(redemption);

    // Then
    expect([firstDay, sameDay, secondDay]).toEqual([true, false, false]);
  });
});
