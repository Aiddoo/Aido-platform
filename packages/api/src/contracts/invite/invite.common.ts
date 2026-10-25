import { z } from "zod";

import {
  INVITE_CODE,
  INVITE_CODE_PATTERN,
  INVITE_FRIENDSHIP,
  REDEMPTION_REJECTION_REASON,
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_UNKNOWN,
  REWARD_TYPE,
} from "../../vocabulary/invite.constants.js";

// 사용자가 붙여 넣은 공백·하이픈·소문자를 서버와 클라가 같은 형태로 맞춘다
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export const inviteCodeFormatSchema = z
  .string()
  .length(INVITE_CODE.LENGTH, `초대 코드는 ${INVITE_CODE.LENGTH}자리예요`)
  .regex(new RegExp(INVITE_CODE_PATTERN), "초대 코드에 쓸 수 없는 글자가 있어요")
  .describe(`초대 코드 (${INVITE_CODE.LENGTH}자, ${INVITE_CODE.ALPHABET} 중에서, 예: K7M2QX)`);

export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .pipe(inviteCodeFormatSchema)
  .describe("초대 코드 (공백·하이픈 제거와 대문자 변환 뒤 6자 검증, 예: k7m2-qx → K7M2QX)");

export type InviteCode = z.output<typeof inviteCodeSchema>;

export const redemptionRejectionReasonSchema = z
  .enum(REDEMPTION_REJECTION_REASON)
  .describe("보상 제외 사유 (EXPIRED: 기한 안에 사용을 시작하지 않음)");

export const redemptionStatusSchema = z
  .enum(REDEMPTION_STATUS)
  .describe(
    "초대 수락 상태 (JOINED: 가입함, QUALIFIED: 사용 시작, REWARDED: 보상 지급 완료, REJECTED: 보상 제외)",
  );

/**
 * 응답에서 읽는 수락 상태. 1.13.0 앱이 뒤에 추가된 상태를 받아도 목록 전체가 실패하지 않게
 * 모르는 값은 UNKNOWN으로 읽는다. 서버가 보내는 값은 redemptionStatusSchema다.
 */
export const invitedFriendStatusSchema = z
  .union([redemptionStatusSchema, z.literal(REDEMPTION_STATUS_UNKNOWN)])
  .catch(REDEMPTION_STATUS_UNKNOWN)
  .describe(
    "초대 수락 상태 (JOINED·QUALIFIED·REWARDED·REJECTED, 앱이 모르는 새 상태는 UNKNOWN으로 읽는다)",
  );

/** 응답에서 읽는 보상 제외 사유. 모르는 새 사유는 null로 읽어 목록을 계속 보여 준다. */
export const invitedFriendRejectionReasonSchema = redemptionRejectionReasonSchema
  .nullable()
  .catch(null)
  .describe("보상 제외 사유 (EXPIRED, 앱이 모르는 새 사유는 null로 읽는다)");

export const inviteFriendshipSchema = z
  .enum(INVITE_FRIENDSHIP)
  .describe("초대 뒤 친구 상태 (FRIENDS: 친구가 됨, REQUESTED: 친구 요청만 보냄)");

const rewardQuantitySchema = z.number().int().positive();

export const inviteRewardSchema = z
  .discriminatedUnion("rewardType", [
    z.object({
      rewardType: z.literal(REWARD_TYPE.PREMIUM_DAYS),
      quantity: rewardQuantitySchema.describe("프리미엄 일수 (양의 정수)"),
    }),
    z.object({
      rewardType: z.literal(REWARD_TYPE.FRIEND_SLOT),
      quantity: rewardQuantitySchema.describe("늘어나는 친구 자리 수 (양의 정수)"),
    }),
  ])
  .describe("보상 (rewardType 판별 유니온)")
  .meta({ example: { rewardType: "PREMIUM_DAYS", quantity: 7 } });

export type InviteReward = z.infer<typeof inviteRewardSchema>;

export type RewardAmount = z.input<typeof inviteRewardSchema>;

export const inviterRewardMilestoneSchema = z
  .object({
    qualifiedCount: z.number().int().positive().describe("보상을 받는 사용 시작 인원"),
    repeatEvery: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("이 단계 뒤로 몇 명마다 같은 보상을 반복할지 (null이면 한 번만 지급)"),
    rewards: z
      .array(inviteRewardSchema)
      .min(1)
      .readonly()
      .describe("이 단계에서 지급하는 보상 목록"),
  })
  .describe("초대한 사람 보상 단계");

export type InviterRewardMilestone = z.input<typeof inviterRewardMilestoneSchema>;
