import {
  INVITE_FRIENDSHIP,
  INVITE_REDEEM_WINDOW_DAYS,
  PREMIUM_SOURCE,
  REDEEM_OUTCOME,
} from '@aido/api/vocabulary';
import type { PremiumAccess } from '@src/features/identity/user/schemas/premium-access.schema';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type { PendingRedemption, RedemptionResult } from '../schemas/invite-redemption.schema';
import { InviteRewardPolicy } from './invite-reward.model';

export function isWithinDays(from: Instant, now: Instant, days: number) {
  return diffMs(now, from) < days * DAY_MS;
}

function isFresh(pending: Pick<PendingRedemption, 'savedAt'>, now: Instant) {
  return isWithinDays(pending.savedAt, now, INVITE_REDEEM_WINDOW_DAYS);
}

/** 이미 친구였으면 친구 상태가 바뀌지 않아 null이다 */
function getFriendship(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.ALREADY_FRIENDS ? null : result.friendship;
}

/** 보상은 새로 가입해 수락한 경우(REDEEMED)에만 있다 */
function getRewards(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED ? result.rewards : [];
}

function getGrantedPremiumDays(result: RedemptionResult) {
  return InviteRewardPolicy.getPremiumDays(getRewards(result));
}

/** 이미 수락한 같은 초대를 다시 수락해 서버가 처음 결과를 돌려줬다. 새로 받은 보상이 아니다 */
function isAlreadyAccepted(result: RedemptionResult) {
  return result.outcome === REDEEM_OUTCOME.REDEEMED && result.isReplay === true;
}

/** 환영 시트가 어떤 결과를 보여 줄지 정한다(문구는 화면이 고른다) */
function getWelcomeVariant(result: RedemptionResult) {
  return match({ result, hasReward: getGrantedPremiumDays(result) > 0 })
    .with({ result: { outcome: REDEEM_OUTCOME.ALREADY_FRIENDS } }, () => 'already-friends' as const)
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
}

/** 초대한 사람 친구 자리가 꽉 차 친구 요청만 보낸 경우 */
function isFriendRequestOnly(result: RedemptionResult) {
  return match(getWelcomeVariant(result))
    .with('requested-with-reward', 'requested-only', () => true)
    .with('already-friends', 'friends-with-reward', 'friends-only', () => false)
    .exhaustive();
}

/** 보상이 없을 때 이유. 같은 기기·신원으로 이미 받았거나, 이미 쓰던 계정이다 */
function getMissingRewardReason(result: RedemptionResult) {
  return match({ outcome: result.outcome, hasReward: getGrantedPremiumDays(result) > 0 })
    .with({ hasReward: true }, () => null)
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, () => 'already-claimed' as const)
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, () => 'existing-account' as const)
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, () => null)
    .exhaustive();
}

/**
 * 받은 보상 프리미엄이 언제 시작하는지. 수락 뒤 다시 불러온 내 정보(서버가 이어 붙인 결과)로만 판단한다.
 * 스토어 구독이나 다른 보상 기간이 진행 중이면 서버가 쌓아 둔 일수(bankedPremiumDays)로 보내고,
 * 그 기간이 끝난 뒤 이어진다.
 */
function getRewardStart(premiumAccess: Pick<PremiumAccess, 'source' | 'bankedDays'>) {
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
}

/** 가입한 지 며칠 안 된 계정만 초대 보상을 기대할 수 있다(서버가 최종 판정한다) */
function isRewardExpected(accountCreatedAt: Instant, now: Instant) {
  return isWithinDays(accountCreatedAt, now, INVITE_REDEEM_WINDOW_DAYS);
}

export const InviteRedemptionPolicy = {
  isFresh,
  getFriendship,
  getGrantedPremiumDays,
  isAlreadyAccepted,
  getWelcomeVariant,
  isFriendRequestOnly,
  getMissingRewardReason,
  getRewardStart,
  isRewardExpected,
} as const;
