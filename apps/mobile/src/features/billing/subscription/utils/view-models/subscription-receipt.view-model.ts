import { PREMIUM_SOURCE } from '@aido/api';
import type { User } from '@src/features/identity/user/domains/user.model';
import { match, P } from 'ts-pattern';

import {
  hasPassed,
  type PremiumAccess,
  PremiumAccessPolicy,
  type PremiumEndingNotice,
} from '../../domains/premium-access.model';

/** 영수증 출처. 관리자, 스토어 구독(결제), 초대 보상 기간 */
export type SubscriptionReceiptVariant = 'admin' | 'paid' | 'reward';

export type SubscriptionReceiptRow =
  | { type: 'account' }
  | { type: 'rewardRecord'; endsAt: Date }
  | { type: 'nextBillingDate'; date: Date }
  /** 결제 예정 시각이 지났는데 스토어 갱신이 아직 서버에 반영되지 않았다(최대 유예 3시간) */
  | { type: 'renewalPending' }
  | { type: 'subscriptionEndsOn'; date: Date }
  | { type: 'autoRenewal'; willRenew: boolean }
  | { type: 'rewardPeriod'; endsAt: Date }
  | { type: 'bankedReward'; days: number; endsAt: Date | null }
  | { type: 'overallPeriod'; endsAt: Date }
  | { type: 'daysLeft'; days: number; endingNotice: PremiumEndingNotice | null };

/** 영수증 아래 한 줄. "그다음엔 어떻게 되나"가 행만으로 드러나지 않을 때만 붙인다 */
export type SubscriptionReceiptFootnote =
  | { type: 'returnsToFreePlan'; date: Date }
  | { type: 'rewardStartsAfterSubscription'; days: number }
  | { type: 'manageAutoRenewalInStore' };

export type SubscriptionReceiptAction = 'subscribe' | 'manage';

interface SubscriptionReceiptContents {
  rows: SubscriptionReceiptRow[];
  footnote: SubscriptionReceiptFootnote | null;
  primaryAction: SubscriptionReceiptAction | null;
}

/** 관리자는 기간이 끝나도 모든 기능을 쓰므로 끝남 안내가 없다 */
export type SubscriptionReceiptViewModel =
  | (SubscriptionReceiptContents & { variant: 'admin'; endingNotice: null })
  | (SubscriptionReceiptContents & {
      variant: Exclude<SubscriptionReceiptVariant, 'admin'>;
      endingNotice: PremiumEndingNotice | null;
    });

interface SubscriptionReceiptContext {
  isStoreConfigured: boolean;
  now: Date;
  timeZone: string;
}

function toBankedRows(access: PremiumAccess, endsAt: Date | null): SubscriptionReceiptRow[] {
  return PremiumAccessPolicy.hasBankedDays(access)
    ? [{ type: 'bankedReward', days: access.bankedDays, endsAt }]
    : [];
}

function toAdminReceipt(access: PremiumAccess): SubscriptionReceiptViewModel {
  const rewardRecordRows: SubscriptionReceiptRow[] =
    PremiumAccessPolicy.isGrantOnly(access) && access.endsAt != null
      ? [{ type: 'rewardRecord', endsAt: access.endsAt }]
      : [];

  return {
    variant: 'admin',
    rows: [{ type: 'account' }, ...rewardRecordRows, ...toBankedRows(access, null)],
    footnote: null,
    primaryAction: null,
    endingNotice: null,
  };
}

function toBillingRow(
  access: PremiumAccess,
  periodEndsAt: Date,
  now: Date,
): SubscriptionReceiptRow {
  if (!access.willRenew) {
    return { type: 'subscriptionEndsOn', date: periodEndsAt };
  }
  return hasPassed(periodEndsAt, now)
    ? { type: 'renewalPending' }
    : { type: 'nextBillingDate', date: periodEndsAt };
}

function toPaidRows(access: PremiumAccess, now: Date): SubscriptionReceiptRow[] {
  const { periodEndsAt } = access;
  if (periodEndsAt == null) {
    return [];
  }

  // 자동 갱신 중이면 보상이 시작하는 날이 갱신마다 밀려 날짜 없이 일수만 보인다(시작 시점은 footnote가 설명한다)
  return [
    toBillingRow(access, periodEndsAt, now),
    { type: 'autoRenewal', willRenew: access.willRenew },
    ...toBankedRows(access, access.willRenew ? null : access.endsAt),
  ];
}

function toPaidFootnote(access: PremiumAccess): SubscriptionReceiptFootnote | null {
  if (PremiumAccessPolicy.hasBankedDays(access)) {
    return { type: 'rewardStartsAfterSubscription', days: access.bankedDays };
  }

  if (access.willRenew) {
    return { type: 'manageAutoRenewalInStore' };
  }

  return access.endsAt == null ? null : { type: 'returnsToFreePlan', date: access.endsAt };
}

function toPaidReceipt(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  return {
    variant: 'paid',
    rows: toPaidRows(access, now),
    footnote: toPaidFootnote(access),
    primaryAction: 'manage',
    endingNotice: PremiumAccessPolicy.endingNotice(access, now, timeZone),
  };
}

function toRewardRows(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): SubscriptionReceiptRow[] {
  const { endsAt, periodEndsAt } = access;
  const daysLeft = PremiumAccessPolicy.daysLeft(access, now, timeZone);
  if (endsAt == null || periodEndsAt == null || daysLeft == null) {
    return [];
  }

  const chainedRows: SubscriptionReceiptRow[] = PremiumAccessPolicy.hasBankedDays(access)
    ? [...toBankedRows(access, null), { type: 'overallPeriod', endsAt }]
    : [];

  return [
    { type: 'rewardPeriod', endsAt: periodEndsAt },
    ...chainedRows,
    {
      type: 'daysLeft',
      days: daysLeft,
      endingNotice: PremiumAccessPolicy.endingNotice(access, now, timeZone),
    },
  ];
}

function toRewardReceipt(
  access: PremiumAccess,
  context: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  return {
    variant: 'reward',
    rows: toRewardRows(access, context),
    footnote: access.endsAt == null ? null : { type: 'returnsToFreePlan', date: access.endsAt },
    primaryAction: context.isStoreConfigured ? 'subscribe' : null,
    endingNotice: PremiumAccessPolicy.endingNotice(access, context.now, context.timeZone),
  };
}

/**
 * 프리미엄 영수증에 무엇을 보일지 정한다. 출처·기간·자동 갱신·이어서 받을 보상은 서버 값을 그대로 쓰고,
 * 여기서는 기기 시간대 기준 남은 일수와 보일 행·안내만 고른다.
 */
export function toSubscriptionReceiptViewModel(
  user: Pick<User, 'role' | 'premiumAccess'>,
  context: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  const access = user.premiumAccess;

  return match({ role: user.role, source: access.source })
    .with({ role: 'ADMIN' }, () => toAdminReceipt(access))
    .with({ source: PREMIUM_SOURCE.GRANT }, () => toRewardReceipt(access, context))
    .with({ source: P.union(PREMIUM_SOURCE.STORE, null) }, () => toPaidReceipt(access, context))
    .exhaustive();
}
