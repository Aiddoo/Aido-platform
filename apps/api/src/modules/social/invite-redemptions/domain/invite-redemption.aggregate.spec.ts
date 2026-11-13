import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import {
  activeDaysOf,
  createInviteRedemptionFixture,
} from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_ID,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";

import { InviteId } from "../../shared/domain/invite-id.vo.js";
import { InviteRedemptionId } from "./invite-redemption-id.vo.js";
import { InviteRedemption } from "./invite-redemption.aggregate.js";

const JOINED_AT = Temporal.Instant.from("2028-02-20T03:00:00Z");

function createRedemption(
  overrides: Parameters<typeof createInviteRedemptionFixture>[0] = {},
): InviteRedemption {
  return createInviteRedemptionFixture({
    joinedAt: JOINED_AT,
    expiresAt: Temporal.Instant.from("2028-03-05T03:00:00Z"),
    ...overrides,
  });
}

describe("InviteRedemption — 초대 수락", () => {
  describe("create", () => {
    it("수락 시각에서 14일 뒤를 사용 시작 마감으로 정하고 시간대와 보상 자격을 고정한다", () => {
      // Given
      const params = {
        id: InviteRedemptionId.reconstitute("credemption00000000000001"),
        inviteId: InviteId.reconstitute(INVITE_FIXTURE_ID),
        inviterId: UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
        inviteeId: UserId.reconstitute(INVITE_FIXTURE_INVITEE_ID),
        timeZone: TimeZone.SEOUL,
        inviterRewardEligible: false,
        now: JOINED_AT,
      };

      // When
      const redemption = InviteRedemption.create(params);

      // Then
      expect(redemption.toPrimitives()).toEqual({
        id: "credemption00000000000001",
        inviteId: INVITE_FIXTURE_ID,
        inviterId: INVITE_FIXTURE_INVITER_ID,
        inviteeId: INVITE_FIXTURE_INVITEE_ID,
        status: "JOINED",
        rejectionReason: null,
        timezone: "Asia/Seoul",
        inviterRewardEligible: false,
        activeDays: [],
        joinedAt: JOINED_AT,
        qualifiedAt: null,
        rewardedAt: null,
        rejectedAt: null,
        expiresAt: Temporal.Instant.from("2028-03-05T03:00:00Z"),
        qualifyReminderSentAt: null,
      });
    });
  });

  describe("recordActivity", () => {
    it("같은 날 두 번 마치면 두 번째는 false이고 날짜 하나만 남는다", () => {
      // Given
      const redemption = createRedemption();

      // When
      const results = [
        redemption.recordActivity(Temporal.Instant.from("2028-02-28T01:00:00Z")),
        redemption.recordActivity(Temporal.Instant.from("2028-02-28T10:00:00Z")),
      ];

      // Then
      expect(results).toEqual([true, false]);
      expect(redemption.activeDays.map(String)).toEqual(["2028-02-28"]);
      expect(redemption.hasEnoughActiveDays()).toBe(false);
    });

    it.each([
      {
        timezone: "Asia/Seoul",
        // 서울 2/28 23:59, 2/29 00:01
        completedAt: ["2028-02-28T14:59:00Z", "2028-02-28T15:01:00Z"],
        expectedDays: ["2028-02-28", "2028-02-29"],
      },
      {
        timezone: "America/Los_Angeles",
        // 로스앤젤레스 2/28 23:59, 2/29 00:01
        completedAt: ["2028-02-29T07:59:00Z", "2028-02-29T08:01:00Z"],
        expectedDays: ["2028-02-28", "2028-02-29"],
      },
    ])(
      "$timezone에서 자정 직전과 직후에 마치면 서로 다른 이틀로 사용 시작이다",
      ({ timezone, completedAt, expectedDays }) => {
        // Given
        const redemption = createRedemption({ timezone });

        // When
        for (const at of completedAt) {
          redemption.recordActivity(Temporal.Instant.from(at));
        }

        // Then
        expect(redemption.activeDays.map(String)).toEqual(expectedDays);
        expect(redemption.hasEnoughActiveDays()).toBe(true);
      },
    );

    it("마감 순간부터는 활동을 기록하지 않는다", () => {
      // Given
      const redemption = createRedemption();

      // When
      const recorded = redemption.recordActivity(Temporal.Instant.from("2028-03-05T03:00:00Z"));

      // Then
      expect(recorded).toBe(false);
      expect(redemption.activeDays).toEqual([]);
    });

    it("사용 시작한 뒤의 활동은 기록하지 않는다", () => {
      // Given
      const redemption = createRedemption({ status: "QUALIFIED" });

      // When
      const recorded = redemption.recordActivity(Temporal.Instant.from("2028-02-28T01:00:00Z"));

      // Then
      expect(recorded).toBe(false);
    });

    it("첫날을 기록하면 첫 활동일이고 같은 날 다시 기록하거나 둘째 날을 기록하면 아니다", () => {
      // Given
      const redemption = createRedemption();

      // When
      const firstDay =
        redemption.recordActivity(Temporal.Instant.from("2028-03-02T03:00:00Z")) &&
        redemption.isOnFirstActiveDay();
      const sameDay = redemption.recordActivity(Temporal.Instant.from("2028-03-02T04:00:00Z"));
      const secondDay =
        redemption.recordActivity(Temporal.Instant.from("2028-03-03T03:00:00Z")) &&
        redemption.isOnFirstActiveDay();

      // Then
      expect([firstDay, sameDay, secondDay]).toEqual([true, false, false]);
    });
  });

  describe("상태 전이", () => {
    it("JOINED → QUALIFIED → REWARDED로 진행하고 같은 전이를 반복하면 false를 반환한다", () => {
      // Given
      const redemption = createRedemption();
      const qualifiedAt = Temporal.Instant.from("2028-02-22T00:00:00Z");
      const rewardedAt = Temporal.Instant.from("2028-02-22T00:01:00Z");

      // When
      const results = [
        redemption.qualify(qualifiedAt),
        redemption.qualify(qualifiedAt),
        redemption.markRewarded(rewardedAt),
        redemption.markRewarded(rewardedAt),
      ];

      // Then
      expect(results).toEqual([true, false, true, false]);
      expect(redemption.toPrimitives()).toMatchObject({
        status: "REWARDED",
        qualifiedAt,
        rewardedAt,
      });
    });

    it("JOINED에서 만료하면 EXPIRED 사유로 거절한다", () => {
      // Given
      const redemption = createRedemption();
      const at = Temporal.Instant.from("2028-03-05T03:00:00Z");

      // When
      const expired = redemption.expire(at);

      // Then
      expect(expired).toBe(true);
      expect(redemption.toPrimitives()).toMatchObject({
        status: "REJECTED",
        rejectionReason: "EXPIRED",
        rejectedAt: at,
      });
    });

    it.each([
      {
        status: "JOINED" as const,
        act: (redemption: InviteRedemption, at: Temporal.Instant) => redemption.markRewarded(at),
      },
      {
        status: "QUALIFIED" as const,
        act: (redemption: InviteRedemption, at: Temporal.Instant) => redemption.expire(at),
      },
      {
        status: "REWARDED" as const,
        act: (redemption: InviteRedemption, at: Temporal.Instant) => redemption.expire(at),
      },
      {
        status: "REJECTED" as const,
        act: (redemption: InviteRedemption, at: Temporal.Instant) => redemption.qualify(at),
      },
    ])("$status에서 허용되지 않은 전이는 SYS_0001로 막는다", ({ status, act }) => {
      // Given
      const redemption = createRedemption({ status });

      // When
      const transition = () => act(redemption, Temporal.Instant.from("2028-02-25T00:00:00Z"));

      // Then
      expect(transition).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_0001,
          details: expect.objectContaining({ detail: "Invalid invite redemption transition" }),
        }),
      );
    });
  });

  describe("사용 시작 알림", () => {
    // 2028-03-02 12:00 KST
    const NOW = Temporal.Instant.from("2028-03-02T03:00:00Z");

    function dueCandidate(
      overrides: Parameters<typeof createInviteRedemptionFixture>[0] = {},
    ): InviteRedemption {
      return createInviteRedemptionFixture({
        joinedAt: Temporal.Instant.from("2028-02-18T03:00:00Z"),
        activeDays: activeDaysOf("2028-02-25"),
        expiresAt: NOW.add({ hours: 72 }),
        ...overrides,
      });
    }

    it.each([
      { label: "마감 3일 전", expiresIn: { hours: 72 }, expected: true },
      { label: "마감 1시간 전", expiresIn: { hours: 1 }, expected: true },
      { label: "마감 3일 1분 전", expiresIn: { hours: 72, minutes: 1 }, expected: false },
      { label: "마감 4일 전", expiresIn: { hours: 96 }, expected: false },
      { label: "마감이 지남", expiresIn: { hours: 0 }, expected: false },
    ])("$label이면 알림 대상 여부는 $expected이다", ({ expiresIn, expected }) => {
      // Given
      const redemption = dueCandidate({ expiresAt: NOW.add(expiresIn) });

      // When
      const isDue = redemption.isQualifyReminderDue(NOW);

      // Then
      expect(isDue).toBe(expected);
    });

    it.each([
      { activeDays: [], expected: false },
      { activeDays: ["2028-02-25"], expected: true },
      { activeDays: ["2028-02-25", "2028-02-26"], expected: false },
    ])("할 일을 끝낸 날이 $activeDays.length일이면 $expected이다", ({ activeDays, expected }) => {
      // Given
      const redemption = dueCandidate({ activeDays: activeDaysOf(...activeDays) });

      // When
      const isDue = redemption.isQualifyReminderDue(NOW);

      // Then
      expect(isDue).toBe(expected);
    });

    it.each([
      { label: "이미 사용 시작", overrides: { status: "QUALIFIED" as const } },
      { label: "만료·거절", overrides: { status: "REJECTED" as const } },
      { label: "이미 알림을 보냄", overrides: { qualifyReminderSentAt: NOW } },
      { label: "초대한 사람이 탈퇴", overrides: { inviterId: null } },
      { label: "초대한 사람 보상이 없는 수락", overrides: { inviterRewardEligible: false } },
      { label: "오늘 이미 할 일을 끝냄", overrides: { activeDays: activeDaysOf("2028-03-02") } },
    ])("$label이면 보내지 않는다", ({ overrides }) => {
      // Given
      const redemption = dueCandidate(overrides);

      // When
      const isDue = redemption.isQualifyReminderDue(NOW);

      // Then
      expect(isDue).toBe(false);
    });

    it("발송 표시는 한 번만 바뀌어 다시 실행해도 대상이 아니다", () => {
      // Given
      const redemption = dueCandidate();

      // When
      const results = [
        redemption.markQualifyReminderSent(NOW),
        redemption.markQualifyReminderSent(NOW),
      ];

      // Then
      expect(results).toEqual([true, false]);
      expect(redemption.isQualifyReminderDue(NOW)).toBe(false);
    });
  });
});
