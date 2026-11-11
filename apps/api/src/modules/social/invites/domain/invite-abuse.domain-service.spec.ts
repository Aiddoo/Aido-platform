import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_OTHER_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";

import {
  decideInviteRedemption,
  isWithinRedeemWindow,
  rewardClaimSources,
} from "./invite-abuse.domain-service.js";

const NOW = Temporal.Instant.from("2028-02-29T12:00:00Z");
const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const INVITEE_ID = UserId.reconstitute(INVITE_FIXTURE_INVITEE_ID);

type DecideParams = Parameters<typeof decideInviteRedemption>[0];

function paramsOf(overrides: Partial<DecideParams> = {}): DecideParams {
  return {
    invite: createInviteFixture(),
    inviteeId: INVITEE_ID,
    inviteeJoinedAt: Temporal.Instant.from("2028-02-28T12:00:00Z"),
    areAlreadyFriends: false,
    isBlockedBetween: false,
    previousRedemption: null,
    hasClaimedReward: false,
    now: NOW,
    ...overrides,
  };
}

const REVOKED = createInviteFixture({ status: "REVOKED", revokedAt: NOW });

describe("decideInviteRedemption — 초대 수락 판정", () => {
  it.each([
    {
      name: "자기 자신의 코드",
      params: paramsOf({ inviteeId: INVITER_ID }),
      expected: { kind: "reject", reason: "SELF_INVITE" },
    },
    {
      name: "차단 관계인 사람의 초대",
      params: paramsOf({ isBlockedBetween: true }),
      expected: { kind: "reject", reason: "BLOCKED" },
    },
    {
      name: "차단 관계에서 같은 초대를 다시 수락한 사용자",
      params: paramsOf({ isBlockedBetween: true, previousRedemption: { inviterId: INVITER_ID } }),
      expected: { kind: "reject", reason: "BLOCKED" },
    },
    {
      name: "폐기된 코드",
      params: paramsOf({ invite: REVOKED }),
      expected: { kind: "reject", reason: "INVITE_REVOKED" },
    },
    {
      name: "이미 친구",
      params: paramsOf({ areAlreadyFriends: true }),
      expected: { kind: "already-friends" },
    },
    {
      name: "가입 8일째 기존 사용자",
      params: paramsOf({ inviteeJoinedAt: Temporal.Instant.from("2028-02-22T12:00:00Z") }),
      expected: { kind: "connect" },
    },
    {
      name: "같은 초대를 다시 수락한 사용자",
      params: paramsOf({
        invite: REVOKED,
        previousRedemption: { inviterId: INVITER_ID },
        areAlreadyFriends: true,
      }),
      expected: { kind: "replay" },
    },
    {
      name: "이미 다른 초대를 수락한 사용자",
      params: paramsOf({
        previousRedemption: { inviterId: UserId.reconstitute(INVITE_FIXTURE_OTHER_INVITER_ID) },
      }),
      expected: { kind: "reject", reason: "ALREADY_REDEEMED" },
    },
    {
      name: "이미 친구인 사람의 초대를 다른 초대 수락 뒤에 연 사용자",
      params: paramsOf({ previousRedemption: { inviterId: null }, areAlreadyFriends: true }),
      expected: { kind: "already-friends" },
    },
    {
      name: "같은 기기·신원으로 보상을 받은 재가입자",
      params: paramsOf({ hasClaimedReward: true }),
      expected: { kind: "redeem", rewardEligible: false },
    },
    {
      name: "처음 온 새 사용자",
      params: paramsOf(),
      expected: { kind: "redeem", rewardEligible: true },
    },
  ])("$name이면 $expected.kind로 판정한다", ({ params, expected }) => {
    // When
    const decision = decideInviteRedemption(params);

    // Then
    expect(decision).toEqual(expected);
  });
});

describe("isWithinRedeemWindow — 새 사용자 기간", () => {
  it.each([
    { joinedAt: "2028-02-22T12:00:00.001Z", expected: true },
    { joinedAt: "2028-02-22T12:00:00.000Z", expected: false },
  ])("가입 시각 $joinedAt은 7일 수락 기간 안이면 $expected다", ({ joinedAt, expected }) => {
    // When
    const within = isWithinRedeemWindow({ joinedAt: Temporal.Instant.from(joinedAt), now: NOW });

    // Then
    expect(within).toBe(expected);
  });
});

describe("rewardClaimSources — 보상 신원", () => {
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

  it("인증한 이메일이 없으면 겹치지 않는 소셜 로그인 계정을 신원으로 쓴다", () => {
    // Given
    const identity = {
      verifiedEmail: null,
      providerAccounts: [
        { provider: "APPLE", providerAccountId: "apple-sub" },
        { provider: "KAKAO", providerAccountId: "kakao-id" },
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
