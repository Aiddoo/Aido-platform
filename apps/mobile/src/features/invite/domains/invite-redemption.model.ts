import {
  INVITE_FRIENDSHIP,
  INVITE_REDEEM_WINDOW_DAYS,
  PREMIUM_SOURCE,
  REDEEM_OUTCOME,
  redeemInviteResponseSchema,
} from '@aido/api';
import type { PremiumAccess } from '@src/features/subscription/domains/premium-access.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { InviteRewardPolicy, InviteRewardSchema } from './invite-reward.model';
import { InviteCodeSchema } from './invite.model';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** 초대 코드가 앱에 들어온 경로. 분석 이벤트 invite_link_opened.source와 같은 값이다 */
export const InviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);

export type InviteLinkSource = z.output<typeof InviteLinkSourceSchema>;

export const PendingRedemptionSchema = z.strictObject({
  inviteCode: InviteCodeSchema,
  source: InviteLinkSourceSchema,
  savedAt: z.coerce.date(),
});

export type PendingRedemption = z.output<typeof PendingRedemptionSchema>;

export function isWithinDays(from: Date, now: Date, days: number) {
  return now.getTime() - from.getTime() < days * DAY_IN_MS;
}

// rewards가 있는 REDEEMED만 모르는 보상 종류를 UNKNOWN으로 흡수하도록 바꾼다
const [RedeemedSchema, ConnectedSchema, AlreadyFriendsSchema] = redeemInviteResponseSchema.options;

export const RedemptionResultSchema = z.discriminatedUnion('outcome', [
  RedeemedSchema.extend({ rewards: z.array(InviteRewardSchema) }),
  ConnectedSchema,
  AlreadyFriendsSchema,
]);

export type RedemptionResult = z.output<typeof RedemptionResultSchema>;

export const InviteRedemptionPolicy = {
  isFresh(pending: PendingRedemption, now: Date) {
    return isWithinDays(pending.savedAt, now, INVITE_REDEEM_WINDOW_DAYS);
  },

  /** 이름을 정하지 않은 초대한 사람은 화면이 넘긴 대체 호칭으로 부른다(공개 프로필이라 태그는 쓰지 않는다) */
  inviterName(result: RedemptionResult, unnamedLabel: string) {
    return result.inviter.name ?? unnamedLabel;
  },

  /** 이미 친구였으면 친구 상태가 바뀌지 않아 null이다 */
  friendship(result: RedemptionResult) {
    return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS ? null : result.friendship;
  },

  /** 보상은 새로 가입해 수락한 경우(REDEEMED)에만 있다 */
  rewards(result: RedemptionResult) {
    return result.outcome === REDEEM_OUTCOME.REDEEMED ? result.rewards : [];
  },

  grantedPremiumDays(result: RedemptionResult) {
    return InviteRewardPolicy.premiumDays(this.rewards(result));
  },

  /** 환영 시트가 어떤 결과를 보여 줄지 정한다(문구는 화면이 고른다) */
  welcomeVariant(result: RedemptionResult) {
    return match({ result, hasReward: this.grantedPremiumDays(result) > 0 })
      .with(
        { result: { outcome: REDEEM_OUTCOME.ALREADY_FRIENDS } },
        () => 'already-friends' as const,
      )
      .with(
        { result: { friendship: INVITE_FRIENDSHIP.FRIENDS }, hasReward: true },
        () => 'friends-with-reward' as const,
      )
      .with(
        { result: { friendship: INVITE_FRIENDSHIP.REQUESTED }, hasReward: true },
        () => 'requested-with-reward' as const,
      )
      .with(
        { result: { friendship: INVITE_FRIENDSHIP.FRIENDS }, hasReward: false },
        () => 'friends-only' as const,
      )
      .with(
        { result: { friendship: INVITE_FRIENDSHIP.REQUESTED }, hasReward: false },
        () => 'requested-only' as const,
      )
      .exhaustive();
  },

  /** 초대한 사람 친구 자리가 꽉 차 친구 요청만 보낸 경우 */
  isFriendRequestOnly(result: RedemptionResult) {
    return match(this.welcomeVariant(result))
      .with('requested-with-reward', 'requested-only', () => true)
      .with('already-friends', 'friends-with-reward', 'friends-only', () => false)
      .exhaustive();
  },

  /** 보상이 없을 때 이유. 같은 기기·신원으로 이미 받았거나, 이미 쓰던 계정이다 */
  missingRewardReason(result: RedemptionResult) {
    return match({ outcome: result.outcome, hasReward: this.grantedPremiumDays(result) > 0 })
      .with({ hasReward: true }, () => null)
      .with({ outcome: REDEEM_OUTCOME.REDEEMED }, () => 'already-claimed' as const)
      .with({ outcome: REDEEM_OUTCOME.CONNECTED }, () => 'existing-account' as const)
      .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, () => null)
      .exhaustive();
  },

  /**
   * 받은 보상 프리미엄이 언제 시작하는지. 수락 뒤 다시 불러온 내 정보(서버가 이어 붙인 결과)로만 판단한다.
   * 스토어 구독이나 다른 보상 기간이 진행 중이면 서버가 쌓아 둔 일수(bankedPremiumDays)로 보내고,
   * 그 기간이 끝난 뒤 이어진다.
   */
  rewardStart(premiumAccess: PremiumAccess) {
    return match({ source: premiumAccess.source, hasBankedDays: premiumAccess.bankedDays > 0 })
      .with(
        { source: PREMIUM_SOURCE.STORE, hasBankedDays: true },
        () => 'after-subscription' as const,
      )
      .with(
        { source: PREMIUM_SOURCE.GRANT, hasBankedDays: true },
        () => 'after-current-reward' as const,
      )
      .otherwise(() => 'now' as const);
  },

  /** 가입한 지 며칠 안 된 계정만 초대 보상을 기대할 수 있다(서버가 최종 판정한다) */
  isRewardExpected(accountCreatedAt: Date, now: Date) {
    return isWithinDays(accountCreatedAt, now, INVITE_REDEEM_WINDOW_DAYS);
  },
};
