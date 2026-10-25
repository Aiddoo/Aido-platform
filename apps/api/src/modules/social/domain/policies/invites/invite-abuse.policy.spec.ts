import { Invite } from "../../aggregates/invites/invite.aggregate.js";
import {
  InviteAbusePolicy,
  type InviteRedeemContext,
  isWithinRedeemWindow,
  rewardClaimSources,
} from "./invite-abuse.policy.js";

const NOW = new Date("2028-02-29T12:00:00.000Z");
const INVITER_ID = "inviter-1";
const INVITEE_ID = "invitee-1";

function invite(status: "ACTIVE" | "REVOKED" = "ACTIVE"): Invite {
  return Invite.reconstitute({
    id: "invite-1",
    inviterId: INVITER_ID,
    code: "K7M2QX",
    status,
    createdAt: new Date("2028-02-01T00:00:00.000Z"),
    revokedAt: null,
  });
}

function context(overrides: Partial<InviteRedeemContext> = {}): InviteRedeemContext {
  return {
    inviteeId: INVITEE_ID,
    inviteeJoinedAt: new Date("2028-02-28T12:00:00.000Z"),
    areAlreadyFriends: false,
    previousRedemption: null,
    hasClaimedReward: false,
    now: NOW,
    ...overrides,
  };
}

describe("InviteAbusePolicy", () => {
  describe("decide", () => {
    it.each([
      {
        name: "자기 자신의 코드",
        invite: invite(),
        context: context({ inviteeId: INVITER_ID }),
        expected: { kind: "reject", reason: "SELF_INVITE" },
      },
      {
        name: "폐기된 코드",
        invite: invite("REVOKED"),
        context: context(),
        expected: { kind: "reject", reason: "INVITE_REVOKED" },
      },
      {
        name: "이미 친구",
        invite: invite(),
        context: context({ areAlreadyFriends: true }),
        expected: { kind: "already-friends" },
      },
      {
        name: "가입 8일째 기존 사용자",
        invite: invite(),
        context: context({ inviteeJoinedAt: new Date("2028-02-22T12:00:00.000Z") }),
        expected: { kind: "connect" },
      },
      {
        name: "같은 초대를 다시 수락한 사용자",
        invite: invite("REVOKED"),
        context: context({
          previousRedemption: { inviterId: INVITER_ID },
          areAlreadyFriends: true,
        }),
        expected: { kind: "replay" },
      },
      {
        name: "이미 다른 초대를 수락한 사용자",
        invite: invite(),
        context: context({ previousRedemption: { inviterId: "someone-else" } }),
        expected: { kind: "reject", reason: "ALREADY_REDEEMED" },
      },
      {
        name: "이미 친구인 사람의 초대를 다른 초대 수락 뒤에 연 사용자",
        invite: invite(),
        context: context({ previousRedemption: { inviterId: null }, areAlreadyFriends: true }),
        expected: { kind: "already-friends" },
      },
      {
        name: "같은 기기·신원으로 보상을 받은 재가입자",
        invite: invite(),
        context: context({ hasClaimedReward: true }),
        expected: { kind: "redeem", rewardEligible: false },
      },
      {
        name: "처음 온 새 사용자",
        invite: invite(),
        context: context(),
        expected: { kind: "redeem", rewardEligible: true },
      },
    ])("$name이면 $expected.kind로 판정한다", ({ invite: target, context: given, expected }) => {
      // Given
      const redeemContext = given;

      // When
      const decision = InviteAbusePolicy.decide(target, redeemContext);

      // Then
      expect(decision).toEqual(expected);
    });
  });

  describe("isWithinRedeemWindow", () => {
    it.each([
      { joinedAt: "2028-02-22T12:00:00.001Z", expected: true },
      { joinedAt: "2028-02-22T12:00:00.000Z", expected: false },
    ])("가입 시각 $joinedAt은 7일 수락 기간 안이면 $expected다", ({ joinedAt, expected }) => {
      // Given
      const joined = new Date(joinedAt);

      // When
      const within = isWithinRedeemWindow(joined, NOW);

      // Then
      expect(within).toBe(expected);
    });
  });

  describe("rewardClaimSources", () => {
    it("기기 ID와 소문자로 정규화한 인증 이메일을 신원으로 쓴다", () => {
      // Given
      const identity = {
        installationId: " 6F9619FF-8B86 ",
        verifiedEmail: " Friend@Example.com ",
        providerAccounts: [{ provider: "KAKAO", providerAccountId: "123" }],
      };

      // When
      const sources = rewardClaimSources(identity);

      // Then
      expect(sources).toEqual([
        { claimKind: "INSTALLATION", value: "6F9619FF-8B86" },
        { claimKind: "IDENTITY", value: "friend@example.com" },
      ]);
    });

    it("인증한 이메일이 없으면 소셜 로그인 계정을 신원으로 쓴다", () => {
      // Given
      const identity = {
        verifiedEmail: null,
        providerAccounts: [
          { provider: "APPLE", providerAccountId: "apple-sub" },
          { provider: "KAKAO", providerAccountId: "kakao-id" },
        ],
      };

      // When
      const sources = rewardClaimSources(identity);

      // Then
      expect(sources).toEqual([
        { claimKind: "IDENTITY", value: "APPLE:apple-sub" },
        { claimKind: "IDENTITY", value: "KAKAO:kakao-id" },
      ]);
    });
  });
});
