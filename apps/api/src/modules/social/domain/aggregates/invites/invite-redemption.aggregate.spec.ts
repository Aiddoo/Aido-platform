import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { InviteRedemption, type InviteRedemptionProps } from "./invite-redemption.aggregate.js";

const JOINED_AT = new Date("2028-02-20T03:00:00.000Z");

function createRedemption(overrides: Partial<InviteRedemptionProps> = {}): InviteRedemption {
  return InviteRedemption.reconstitute({
    id: "credemption00000000000001",
    inviteId: "cinvite000000000000000001",
    inviterId: "cinviter00000000000000001",
    inviteeId: "cinvitee00000000000000001",
    status: "JOINED",
    rejectionReason: null,
    activeDays: [],
    joinedAt: JOINED_AT,
    qualifiedAt: null,
    rewardedAt: null,
    rejectedAt: null,
    expiresAt: new Date("2028-03-05T03:00:00.000Z"),
    ...overrides,
  });
}

describe("InviteRedemption", () => {
  describe("planCreation", () => {
    it("가입 시각에서 14일 뒤를 사용 시작 마감으로 정한다", () => {
      // Given
      const input = {
        inviteId: "cinvite000000000000000001",
        inviterId: "cinviter00000000000000001",
        inviteeId: "cinvitee00000000000000001",
        joinedAt: JOINED_AT,
      };

      // When
      const plan = InviteRedemption.planCreation(input);

      // Then
      expect(plan).toEqual({
        ...input,
        status: "JOINED",
        expiresAt: new Date("2028-03-05T03:00:00.000Z"),
      });
    });
  });

  describe("recordActiveDay", () => {
    it("같은 날짜를 두 번 기록하면 두 번째는 false를 반환한다", () => {
      // Given
      const redemption = createRedemption();
      const at = new Date("2028-02-21T00:00:00.000Z");

      // When
      const first = redemption.recordActiveDay("2028-02-21", at);
      const second = redemption.recordActiveDay("2028-02-21", at);

      // Then
      expect([first, second]).toEqual([true, false]);
      expect(redemption.toPersistence().addedActiveDays).toEqual(["2028-02-21"]);
    });

    it("마감이 지난 뒤의 활동은 기록하지 않는다", () => {
      // Given
      const redemption = createRedemption();

      // When
      const recorded = redemption.recordActiveDay(
        "2028-03-05",
        new Date("2028-03-05T03:00:00.000Z"),
      );

      // Then
      expect(recorded).toBe(false);
      expect(redemption.activeDays).toEqual([]);
    });
  });

  describe("상태 전이", () => {
    it("JOINED → QUALIFIED → REWARDED로 진행하고 같은 전이를 반복하면 false를 반환한다", () => {
      // Given
      const redemption = createRedemption();
      const qualifiedAt = new Date("2028-02-22T00:00:00.000Z");
      const rewardedAt = new Date("2028-02-22T00:01:00.000Z");

      // When
      const results = [
        redemption.qualify(qualifiedAt),
        redemption.qualify(qualifiedAt),
        redemption.markRewarded(rewardedAt),
        redemption.markRewarded(rewardedAt),
      ];

      // Then
      expect(results).toEqual([true, false, true, false]);
      expect(redemption.toPersistence()).toMatchObject({
        status: "REWARDED",
        qualifiedAt,
        rewardedAt,
      });
    });

    it("JOINED에서 만료하면 EXPIRED 사유로 거절한다", () => {
      // Given
      const redemption = createRedemption();
      const at = new Date("2028-03-05T03:00:00.000Z");

      // When
      const expired = redemption.expire(at);

      // Then
      expect(expired).toBe(true);
      expect(redemption.toPersistence()).toMatchObject({
        status: "REJECTED",
        rejectionReason: "EXPIRED",
        rejectedAt: at,
      });
    });

    it.each([
      { status: "JOINED" as const, act: (r: InviteRedemption, at: Date) => r.markRewarded(at) },
      { status: "QUALIFIED" as const, act: (r: InviteRedemption, at: Date) => r.expire(at) },
      { status: "REWARDED" as const, act: (r: InviteRedemption, at: Date) => r.expire(at) },
      { status: "REJECTED" as const, act: (r: InviteRedemption, at: Date) => r.qualify(at) },
    ])("$status에서 허용되지 않은 전이는 DomainException을 던진다", ({ status, act }) => {
      // Given
      const redemption = createRedemption({ status });

      // When
      const transition = () => act(redemption, new Date("2028-02-25T00:00:00.000Z"));

      // Then
      expect(transition).toThrow(DomainException);
    });
  });
});
