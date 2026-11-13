import { INVITE_FRIENDSHIP, REDEEM_OUTCOME } from '@aido/api/vocabulary';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { InviteRewardPolicy, inviteRewardSchema } from './invite-reward.model';

const inviterSummarySchema = userSummarySchema.omit({ id: true }).extend({ userId: z.string() });

const inviteFriendshipSchema = z.enum(INVITE_FRIENDSHIP);

export const redemptionResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal(REDEEM_OUTCOME.REDEEMED),
    inviter: inviterSummarySchema,
    friendship: inviteFriendshipSchema,
    rewards: z.array(inviteRewardSchema),
    isReplay: z.boolean(),
  }),
  z.object({
    outcome: z.literal(REDEEM_OUTCOME.CONNECTED),
    inviter: inviterSummarySchema,
    friendship: inviteFriendshipSchema,
  }),
  z.object({
    outcome: z.literal(REDEEM_OUTCOME.ALREADY_FRIENDS),
    inviter: inviterSummarySchema,
  }),
]);
export type RedemptionResult = z.infer<typeof redemptionResultSchema>;

// 이미 친구였으면 친구 상태가 바뀌지 않아 null이다
function getFriendship(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS ? null : result.friendship;
}

function getRewards(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED ? result.rewards : [];
}

function getGrantedPremiumDays(result: RedemptionResult) {
  return InviteRewardPolicy.getPremiumDays(getRewards(result));
}

// 같은 초대를 다시 수락하면 서버가 처음 결과를 돌려준다. 새로 받은 보상이 아니다
function isAlreadyAccepted(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED && result.isReplay;
}

// 이미 친구였으면 축하할 것이 없어 환영 시트 없이 바로 친구 할 일로 간다
function isAlreadyFriends(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS;
}

// 초대한 사람 친구 자리가 꽉 차 친구 요청만 보냈다
function isFriendRequestOnly(result: RedemptionResult) {
  return getFriendship(result) === INVITE_FRIENDSHIP.REQUESTED;
}

// 같은 기기·신원으로 이미 받았거나 이미 쓰던 계정이라 보상이 없다
function getMissingRewardReason(result: RedemptionResult) {
  return match({ outcome: result.outcome, hasReward: getGrantedPremiumDays(result) > 0 })
    .with({ hasReward: true }, () => null)
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, () => 'already-claimed' as const)
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, () => 'existing-account' as const)
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, () => null)
    .exhaustive();
}

/** 서버가 돌려준 수락 결과 */
export const InviteRedemptionPolicy = {
  getFriendship,
  getGrantedPremiumDays,
  isAlreadyAccepted,
  isAlreadyFriends,
  isFriendRequestOnly,
  getMissingRewardReason,
} as const;
