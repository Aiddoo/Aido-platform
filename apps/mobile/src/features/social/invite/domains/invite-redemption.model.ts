import {
  INVITE_FRIENDSHIP,
  INVITE_REDEEM_WINDOW_DAYS,
  PREMIUM_SOURCE,
  REDEEM_OUTCOME,
} from '@aido/api/vocabulary';
import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from '@src/features/identity/user/domains/premium-access.model';
import { type User } from '@src/features/identity/user/domains/user.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { inviteCodeSchema } from './invite-code.model';
import { InviteRewardPolicy, inviteRewardSchema } from './invite-reward.model';

// 분석 이벤트 invite_link_opened.source와 같은 값이다
export const inviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);
export type InviteLinkSource = z.infer<typeof inviteLinkSourceSchema>;

export const pendingRedemptionSchema = z.strictObject({
  inviteCode: inviteCodeSchema,
  source: inviteLinkSourceSchema,
  savedAt: instantSchema,
});
export type PendingRedemption = z.infer<typeof pendingRedemptionSchema>;

const inviterSummarySchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  userTag: z.string(),
  profileImage: z.string().nullable(),
});

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

function isWithinDays(from: Instant, now: Instant, days: number) {
  return diffMs(now, from) < days * DAY_MS;
}

export function isFresh(pending: PendingRedemption, now: Instant) {
  return isWithinDays(pending.savedAt, now, INVITE_REDEEM_WINDOW_DAYS);
}

// 이미 친구였으면 친구 상태가 바뀌지 않아 null이다
export function getFriendship(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS ? null : result.friendship;
}

function getRewards(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED ? result.rewards : [];
}

export function getGrantedPremiumDays(result: RedemptionResult) {
  return InviteRewardPolicy.getPremiumDays(getRewards(result));
}

// 같은 초대를 다시 수락하면 서버가 처음 결과를 돌려준다. 새로 받은 보상이 아니다
export function isAlreadyAccepted(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED && result.isReplay;
}

// 이미 친구였으면 축하할 것이 없어 환영 시트 없이 바로 친구 할 일로 간다
export function isAlreadyFriends(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS;
}

// 초대한 사람 친구 자리가 꽉 차 친구 요청만 보냈다
export function isFriendRequestOnly(result: RedemptionResult) {
  return getFriendship(result) === INVITE_FRIENDSHIP.REQUESTED;
}

// 같은 기기·신원으로 이미 받았거나 이미 쓰던 계정이라 보상이 없다
export function getMissingRewardReason(result: RedemptionResult) {
  return match({ outcome: result.outcome, hasReward: getGrantedPremiumDays(result) > 0 })
    .with({ hasReward: true }, () => null)
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, () => 'already-claimed' as const)
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, () => 'existing-account' as const)
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, () => null)
    .exhaustive();
}

// 수락 뒤 다시 받은 내 정보로만 판단한다. 구독·다른 보상 기간 중이면 서버가 쌓아 두고 그 뒤에 잇는다
export function getRewardStart(premiumAccess: PremiumAccess) {
  return match({
    source: premiumAccess.source,
    hasBankedDays: PremiumAccessPolicy.hasBankedDays(premiumAccess),
  })
    .with(
      { source: PREMIUM_SOURCE.STORE, hasBankedDays: true },
      () => 'after-subscription' as const,
    )
    .with(
      { source: PREMIUM_SOURCE.GRANT, hasBankedDays: true },
      () => 'after-current-reward' as const,
    )
    .otherwise(() => 'now' as const);
}

// 가입한 지 며칠 안 된 계정만 보상을 기대할 수 있다. 최종 판정은 서버다
export function isRewardExpected(user: User, now: Instant) {
  return isWithinDays(user.createdAt, now, INVITE_REDEEM_WINDOW_DAYS);
}

/** 기기에 저장해 둔 수락 대기 초대 */
export const PendingRedemptionPolicy = {
  isFresh,
} as const;

/** 서버가 돌려준 수락 결과 */
export const InviteRedemptionPolicy = {
  getFriendship,
  getGrantedPremiumDays,
  isAlreadyAccepted,
  isAlreadyFriends,
  isFriendRequestOnly,
  getMissingRewardReason,
} as const;

/** 초대받은 사람의 프리미엄 효력으로 보는 보상 시작 */
export const InviteePremiumAccessPolicy = {
  getRewardStart,
} as const;

/** 초대받은 사람의 계정으로 보는 보상 기대 */
export const InviteeUserPolicy = {
  isRewardExpected,
} as const;
