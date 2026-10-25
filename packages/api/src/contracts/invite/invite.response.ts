import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../common/datetime.js";
import { REDEEM_OUTCOME } from "../../vocabulary/invite.constants.js";
import {
  inviteCodeFormatSchema,
  inviteFriendshipSchema,
  inviteRewardSchema,
  redemptionStatusSchema,
} from "./invite.common.js";

const userTagSchema = z
  .string()
  .length(8)
  .describe("사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)");
const userNameSchema = z.string().nullable().describe("사용자 이름 (미설정 시 null)");
const profileImageSchema = z
  .string()
  .nullable()
  .describe("프로필 이미지 (고양이 아이콘 키 또는 URL, 미설정 시 null)");

export const invitePreviewInviterSchema = z
  .object({
    name: userNameSchema,
    userTag: userTagSchema,
    profileImage: profileImageSchema,
  })
  .describe("초대한 사람 공개 프로필 (로그인 전에도 보이므로 이름·태그·프로필 이미지만 담는다)");

export type InvitePreviewInviter = z.infer<typeof invitePreviewInviterSchema>;

export const invitePreviewResponseSchema = z
  .object({
    inviter: invitePreviewInviterSchema,
  })
  .meta({
    example: {
      inviter: { name: "매튜", userTag: "MATT2025", profileImage: "orange_tabby" },
    },
  });

export type InvitePreviewResponse = z.infer<typeof invitePreviewResponseSchema>;

export const inviterSummarySchema = invitePreviewInviterSchema
  .extend({
    userId: z.cuid().describe("초대한 사람 사용자 ID (CUID 25자)"),
  })
  .describe("초대한 사람 요약 (환영 화면과 친구 화면 이동용)");

export type InviterSummary = z.infer<typeof inviterSummarySchema>;

export const inviteMilestoneSchema = z
  .object({
    qualifiedCount: z
      .number()
      .int()
      .positive()
      .describe("이 단계에 도달하는 누적 사용 시작 친구 수 (양의 정수)"),
    rewards: z.array(inviteRewardSchema).describe("이 단계에서 받는 보상 목록"),
  })
  .describe("초대한 사람 보상 단계");

export type InviteMilestone = z.infer<typeof inviteMilestoneSchema>;

export const myInviteResponseSchema = z
  .object({
    code: inviteCodeFormatSchema,
    link: z.url().describe("초대 링크 (예: https://aido.kr/i/K7M2QX)"),
    waitingCount: z
      .number()
      .int()
      .nonnegative()
      .describe("가입했지만 아직 사용 시작 전인 친구 수 (음이 아닌 정수)"),
    qualifiedCount: z
      .number()
      .int()
      .nonnegative()
      .describe("사용 시작까지 마친 친구 수 (음이 아닌 정수)"),
    premiumDaysInWindow: z
      .number()
      .int()
      .nonnegative()
      .describe("최근 30일 동안 초대로 받은 프리미엄 일수 (월 상한 판단용, 음이 아닌 정수)"),
    totalPremiumDays: z
      .number()
      .int()
      .nonnegative()
      .describe("지금까지 초대로 받은 프리미엄 일수 (누적 상한 판단용, 음이 아닌 정수)"),
    nextMilestone: inviteMilestoneSchema
      .nullable()
      .describe("다음 보상 단계 (더 받을 단계가 없으면 null)"),
    rewardsEarned: z
      .array(inviteRewardSchema)
      .describe("지금까지 받은 보상의 종류별 합계 (받은 적 없는 종류는 빠진다)"),
    createdAt: datetimeSchema.describe("현재 초대 코드 발급 시각 (ISO 8601 UTC)"),
  })
  .meta({
    example: {
      code: "K7M2QX",
      link: "https://aido.kr/i/K7M2QX",
      waitingCount: 1,
      qualifiedCount: 2,
      premiumDaysInWindow: 14,
      totalPremiumDays: 14,
      nextMilestone: {
        qualifiedCount: 3,
        rewards: [
          { rewardType: "PREMIUM_DAYS", quantity: 7 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      },
      rewardsEarned: [
        { rewardType: "PREMIUM_DAYS", quantity: 14 },
        { rewardType: "FRIEND_SLOT", quantity: 2 },
      ],
      createdAt: "2026-11-01T09:00:00.000Z",
    },
  });

export type MyInviteResponse = z.infer<typeof myInviteResponseSchema>;

export const invitedFriendResponseSchema = z
  .object({
    userId: z.cuid().describe("초대받은 사람 사용자 ID (CUID 25자, 다음 페이지 cursor로 쓴다)"),
    name: userNameSchema,
    userTag: userTagSchema,
    profileImage: profileImageSchema,
    status: redemptionStatusSchema,
    activeDayCount: z
      .number()
      .int()
      .nonnegative()
      .describe("할 일을 완료한 서로 다른 날짜 수 (초대받은 사람 시간대 기준, 음이 아닌 정수)"),
    joinedAt: datetimeSchema.describe("초대 수락 시각 (ISO 8601 UTC)"),
    qualifiedAt: nullableDatetimeSchema.describe("사용 시작 시각 (ISO 8601 UTC, 아직이면 null)"),
  })
  .meta({
    example: {
      userId: "clz7x5p8k0005qz0z8z8z8z8z",
      name: "존",
      userTag: "JOHN2026",
      profileImage: "russian_blue",
      status: "JOINED",
      activeDayCount: 1,
      joinedAt: "2026-11-02T10:30:00.000Z",
      qualifiedAt: null,
    },
  });

export type InvitedFriendResponse = z.infer<typeof invitedFriendResponseSchema>;

export const invitedFriendsListResponseSchema = z
  .object({
    items: z
      .array(invitedFriendResponseSchema)
      .describe("초대한 친구 목록 (joinedAt 내림차순, 같으면 userId 내림차순)"),
    totalCount: z.number().int().nonnegative().describe("전체 초대한 친구 수 (음이 아닌 정수)"),
    hasMore: z.boolean().describe("다음 페이지 존재 여부"),
  })
  .meta({
    example: {
      items: [
        {
          userId: "clz7x5p8k0005qz0z8z8z8z8z",
          name: "존",
          userTag: "JOHN2026",
          profileImage: "russian_blue",
          status: "QUALIFIED",
          activeDayCount: 2,
          joinedAt: "2026-11-02T10:30:00.000Z",
          qualifiedAt: "2026-11-03T12:00:00.000Z",
        },
      ],
      totalCount: 3,
      hasMore: false,
    },
  });

export type InvitedFriendsListResponse = z.infer<typeof invitedFriendsListResponseSchema>;

export const redeemInviteResponseSchema = z
  .discriminatedUnion("outcome", [
    z
      .object({
        outcome: z.literal(REDEEM_OUTCOME.REDEEMED),
        inviter: inviterSummarySchema,
        friendship: inviteFriendshipSchema,
        rewards: z
          .array(inviteRewardSchema)
          .describe("초대받은 사람이 받은 보상 (같은 기기·같은 신원으로 이미 받았으면 빈 배열)"),
      })
      .describe("신규 사용자가 초대를 수락함"),
    z
      .object({
        outcome: z.literal(REDEEM_OUTCOME.CONNECTED),
        inviter: inviterSummarySchema,
        friendship: inviteFriendshipSchema,
      })
      .describe("기존 사용자가 보상 없이 친구를 맺음"),
    z
      .object({
        outcome: z.literal(REDEEM_OUTCOME.ALREADY_FRIENDS),
        inviter: inviterSummarySchema,
      })
      .describe("이미 친구라서 바뀐 것이 없음"),
  ])
  .describe("초대 수락 결과 (outcome 판별 유니온)")
  .meta({
    example: {
      outcome: "REDEEMED",
      inviter: {
        userId: "clz7x5p8k0001qz0z8z8z8z8z",
        name: "매튜",
        userTag: "MATT2025",
        profileImage: "orange_tabby",
      },
      friendship: "FRIENDS",
      rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
    },
  });

export type RedeemInviteResponse = z.infer<typeof redeemInviteResponseSchema>;

export const inviteAvailabilityResponseSchema = z
  .object({
    enabled: z.boolean().describe("친구 초대 기능 사용 가능 여부"),
  })
  .meta({ example: { enabled: true } });

export type InviteAvailabilityResponse = z.infer<typeof inviteAvailabilityResponseSchema>;
