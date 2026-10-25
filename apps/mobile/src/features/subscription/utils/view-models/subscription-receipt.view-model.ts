import type { User } from '@src/features/user/domains/user.model';
import { match, P } from 'ts-pattern';

import {
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

export interface SubscriptionReceiptViewModel {
  variant: SubscriptionReceiptVariant;
  rows: SubscriptionReceiptRow[];
  footnote: SubscriptionReceiptFootnote | null;
  primaryAction: SubscriptionReceiptAction | null;
  endingNotice: PremiumEndingNotice | null;
}

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

function toPaidRows(access: PremiumAccess): SubscriptionReceiptRow[] {
  const { periodEndsAt } = access;
  if (periodEndsAt == null) {
    return [];
  }

  return [
    access.willRenew
      ? { type: 'nextBillingDate', date: periodEndsAt }
      : { type: 'subscriptionEndsOn', date: periodEndsAt },
    { type: 'autoRenewal', willRenew: access.willRenew },
    ...toBankedRows(access, access.endsAt),
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
    rows: toPaidRows(access),
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
    .with({ source: 'GRANT' }, () => toRewardReceipt(access, context))
    .with({ source: P.union('STORE', null) }, () => toPaidReceipt(access, context))
    .exhaustive();
}
