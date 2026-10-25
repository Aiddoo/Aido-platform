import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  getInvitedFriendsQuerySchema,
  type InviterRewardMilestone,
  inviteCodeParamSchema,
  inviteRewardSchema,
  inviterRewardMilestoneSchema,
  invitedFriendResponseSchema,
  redeemInviteResponseSchema,
  type RewardAmount,
} from "../src/index.js";
import { INVITEE_REWARDS, INVITER_REWARD_MILESTONES } from "../src/vocabulary/index.js";

const inviter = {
  userId: "clz7x5p8k0001qz0z8z8z8z8z",
  name: "매튜",
  userTag: "MATT2025",
  profileImage: "orange_tabby",
};

describe("inviteCodeParamSchema", () => {
  it("공백·하이픈·소문자가 섞인 코드를 대문자 6자로 맞춘다", () => {
    // Given
    const param = { code: " k7m-2 qx\n" };

    // When
    const result = inviteCodeParamSchema.parse(param);

    // Then
    expect(result).toEqual({ code: "K7M2QX" });
  });

  it.each(["K7M2Q0", "K7M2QO", "K7M2Q1", "K7M2QI", "K7M2QL", "K7M2QA"])(
    "헷갈리는 글자나 모음이 들어간 %s는 거부한다",
    (code) => {
      // Given
      const param = { code };

      // When
      const result = inviteCodeParamSchema.safeParse(param);

      // Then
      expect(result.success).toBe(false);
    },
  );

  it.each(["K7M2Q", "K7M2QXZ"])("정리한 뒤 6자가 아닌 %s는 거부한다", (code) => {
    // Given
    const param = { code };

    // When
    const result = inviteCodeParamSchema.safeParse(param);

    // Then
    expect(result.success).toBe(false);
  });
});

describe("redeemInviteResponseSchema", () => {
  it("REDEEMED 결과는 친구 상태와 받은 보상을 함께 읽는다", () => {
    // Given
    const response = {
      outcome: "REDEEMED",
      inviter,
      friendship: "REQUESTED",
      rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
    };

    // When
    const result = redeemInviteResponseSchema.parse(response);

    // Then
    expect(result.outcome === "REDEEMED" && result.rewards).toEqual([
      { rewardType: "PREMIUM_DAYS", quantity: 7 },
    ]);
  });

  it("REDEEMED 결과에 보상 목록이 없으면 거부한다", () => {
    // Given
    const response = { outcome: "REDEEMED", inviter, friendship: "FRIENDS" };

    // When
    const result = redeemInviteResponseSchema.safeParse(response);

    // Then
    expect(result.success).toBe(false);
  });

  it("CONNECTED 결과는 보상 없이 친구 상태만 읽는다", () => {
    // Given
    const response = { outcome: "CONNECTED", inviter, friendship: "FRIENDS" };

    // When
    const result = redeemInviteResponseSchema.parse(response);

    // Then
    expect(result).toEqual(response);
    expect(result).not.toHaveProperty("rewards");
  });

  it("CONNECTED 결과에 친구 상태가 없으면 거부한다", () => {
    // Given
    const response = { outcome: "CONNECTED", inviter };

    // When
    const result = redeemInviteResponseSchema.safeParse(response);

    // Then
    expect(result.success).toBe(false);
  });

  it("보상 수량이 0이면 거부한다", () => {
    // Given
    const response = {
      outcome: "REDEEMED",
      inviter,
      friendship: "FRIENDS",
      rewards: [{ rewardType: "FRIEND_SLOT", quantity: 0 }],
    };

    // When
    const result = redeemInviteResponseSchema.safeParse(response);

    // Then
    expect(result.success).toBe(false);
  });
});

describe("초대 보상 표", () => {
  it("초대받은 사람 보상 표는 보상 스키마를 만족한다", () => {
    // Given
    const rewards: readonly RewardAmount[] = INVITEE_REWARDS;

    // When
    const result = z.array(inviteRewardSchema).safeParse(rewards);

    // Then
    expect(result.success).toBe(true);
  });

  it("초대한 사람 보상 단계 표는 단계 스키마를 만족한다", () => {
    // Given
    const milestones: readonly InviterRewardMilestone[] = INVITER_REWARD_MILESTONES;

    // When
    const result = z.array(inviterRewardMilestoneSchema).safeParse(milestones);

    // Then
    expect(result.success).toBe(true);
  });
});

describe("getInvitedFriendsQuerySchema", () => {
  it("상태를 생략하면 전체, JOINED면 기다리는 친구만 고르고 limit 기본값은 20이다", () => {
    // Given
    const all = {};
    const waiting = { status: "JOINED", limit: "10" };

    // When
    const parsedAll = getInvitedFriendsQuerySchema.parse(all);
    const parsedWaiting = getInvitedFriendsQuerySchema.parse(waiting);

    // Then
    expect(parsedAll).toEqual({ limit: 20 });
    expect(parsedWaiting).toEqual({ status: "JOINED", limit: 10 });
  });

  it.each([{ status: "WAITING" }, { limit: "51" }])("허용하지 않는 값 %o는 거부한다", (query) => {
    // Given
    const input = query;

    // When
    const result = getInvitedFriendsQuerySchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });
});

describe("invitedFriendResponseSchema", () => {
  const friend = {
    userId: "clz7x5p8k0005qz0z8z8z8z8z",
    name: null,
    userTag: "JOHN2026",
    profileImage: null,
    status: "REJECTED",
    activeDayCount: 1,
    joinedAt: "2026-11-02T10:30:00.000Z",
    qualifiedAt: null,
  };

  it.each([
    { name: "구버전 서버처럼 사유를 생략한", rejectionReason: undefined, expected: true },
    { name: "기한이 지나 제외된", rejectionReason: "EXPIRED", expected: true },
    { name: "모르는 사유가 온", rejectionReason: "UNKNOWN", expected: false },
  ])("$name 항목의 허용 여부는 $expected다", ({ rejectionReason, expected }) => {
    // Given
    const response = { ...friend, rejectionReason };

    // When
    const result = invitedFriendResponseSchema.safeParse(response);

    // Then
    expect(result.success).toBe(expected);
  });
});
