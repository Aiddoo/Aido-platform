import { InviteRedemption } from "../../aggregates/invites/invite-redemption.aggregate.js";
import {
  hasEnoughActiveDays,
  InviteQualificationPolicy,
  localActivityDate,
} from "./invite-qualification.policy.js";

function joinedRedemption(): InviteRedemption {
  return InviteRedemption.reconstitute({
    id: "redemption-1",
    inviteId: "invite-1",
    inviterId: "inviter-1",
    inviteeId: "invitee-1",
    status: "JOINED",
    rejectionReason: null,
    timezone: "Asia/Seoul",
    inviterRewardEligible: true,
    activeDays: [],
    joinedAt: new Date("2028-02-20T00:00:00.000Z"),
    qualifiedAt: null,
    rewardedAt: null,
    rejectedAt: null,
    expiresAt: new Date("2028-03-05T00:00:00.000Z"),
  });
}

function recordCompletions(timezone: string, completedAt: readonly string[]): InviteRedemption {
  const redemption = joinedRedemption();
  for (const at of completedAt) {
    const occurredAt = new Date(at);
    redemption.recordActiveDay(localActivityDate(occurredAt, timezone), occurredAt);
  }
  return redemption;
}

describe("InviteQualificationPolicy", () => {
  it("같은 날 할 일을 두 번 마쳐도 사용 시작이 아니다", () => {
    // Given
    const redemption = recordCompletions("Asia/Seoul", [
      "2028-02-28T01:00:00.000Z",
      "2028-02-28T10:00:00.000Z",
    ]);

    // When
    const isQualified = InviteQualificationPolicy.isQualified(redemption);

    // Then
    expect(isQualified).toBe(false);
  });

  it.each([
    {
      timezone: "Asia/Seoul",
      // 서울 2/28 23:59, 2/29 00:01
      completedAt: ["2028-02-28T14:59:00.000Z", "2028-02-28T15:01:00.000Z"],
      expectedDays: ["2028-02-28", "2028-02-29"],
    },
    {
      timezone: "America/Los_Angeles",
      // 로스앤젤레스 2/28 23:59, 2/29 00:01
      completedAt: ["2028-02-29T07:59:00.000Z", "2028-02-29T08:01:00.000Z"],
      expectedDays: ["2028-02-28", "2028-02-29"],
    },
  ])(
    "$timezone에서 자정 직전과 직후에 마치면 서로 다른 이틀로 사용 시작이다",
    ({ timezone, completedAt, expectedDays }) => {
      // Given
      const redemption = recordCompletions(timezone, completedAt);

      // When
      const isQualified = InviteQualificationPolicy.isQualified(redemption);

      // Then
      expect(redemption.activeDays).toEqual(expectedDays);
      expect(isQualified).toBe(true);
    },
  );

  it.each([
    { count: 1, expected: false },
    { count: 2, expected: true },
  ])("서로 다른 날짜 $count일이면 사용 시작 여부는 $expected다", ({ count, expected }) => {
    // Given
    const activeDayCount = count;

    // When
    const result = hasEnoughActiveDays(activeDayCount);

    // Then
    expect(result).toBe(expected);
  });
});
