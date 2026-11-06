import {
  hasPassed,
  PremiumAccessPolicy,
} from '@src/features/identity/user/domains/premium-access.model';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import type { PremiumAccess } from '@src/features/identity/user/schemas/premium-access.schema';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import type { Instant } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

/** 곧 끝난다는 안내를 어느 날로 보일지. 끝나는 날이면 today, 하루 남았으면 tomorrow다 */
export type PremiumEndingNotice = 'tomorrow' | 'today';

/** 영수증 출처. 관리자, 스토어 구독(결제), 초대 보상 기간 */
type SubscriptionReceiptVariant = 'admin' | 'paid' | 'reward';

export type SubscriptionReceiptRow =
  | { type: 'account' }
  | { type: 'rewardRecord'; endsAt: Instant }
  | { type: 'nextBillingDate'; date: Instant }
  /** 결제 예정 시각이 지났는데 스토어 갱신이 아직 서버에 반영되지 않았다(최대 유예 3시간) */
  | { type: 'renewalPending' }
  | { type: 'subscriptionEndsOn'; date: Instant }
  | { type: 'autoRenewal'; willRenew: boolean }
  | { type: 'rewardPeriod'; endsAt: Instant }
  | { type: 'bankedReward'; days: number; endsAt: Instant | null }
  | { type: 'overallPeriod'; endsAt: Instant }
  | { type: 'daysLeft'; days: number; endingNotice: PremiumEndingNotice | null };

/** 영수증 아래 한 줄. "그다음엔 어떻게 되나"가 행만으로 드러나지 않을 때만 붙인다 */
type SubscriptionReceiptFootnote =
  | { type: 'returnsToFreePlan'; date: Instant }
  | { type: 'rewardStartsAfterSubscription'; days: number }
  | { type: 'manageAutoRenewalInStore' };

type SubscriptionReceiptAction = 'subscribe' | 'manage';

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
  now: Instant;
  timeZone: string;
}

function toEndingNotice(
  access: PremiumAccess,
  { now, timeZone }: Pick<SubscriptionReceiptContext, 'now' | 'timeZone'>,
): PremiumEndingNotice | null {
  if (!PremiumAccessPolicy.isExpiringSoon(access, now, timeZone)) {
    return null;
  }
  return PremiumAccessPolicy.getDaysLeft(access, now, timeZone) === 0 ? 'today' : 'tomorrow';
}

function toBankedRows(access: PremiumAccess, endsAt: Instant | null): SubscriptionReceiptRow[] {
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
  periodEndsAt: Instant,
  now: Instant,
): SubscriptionReceiptRow {
  if (!access.willRenew) {
    return { type: 'subscriptionEndsOn', date: periodEndsAt };
  }
  return hasPassed(periodEndsAt, now)
    ? { type: 'renewalPending' }
    : { type: 'nextBillingDate', date: periodEndsAt };
}

function toPaidRows(access: PremiumAccess, now: Instant): SubscriptionReceiptRow[] {
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
    endingNotice: toEndingNotice(access, { now, timeZone }),
  };
}

function toRewardRows(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): SubscriptionReceiptRow[] {
  const { endsAt, periodEndsAt } = access;
  const daysLeft = PremiumAccessPolicy.getDaysLeft(access, now, timeZone);
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
      endingNotice: toEndingNotice(access, { now, timeZone }),
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
    endingNotice: toEndingNotice(access, context),
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

  return match(user)
    .when(UserPolicy.isAdmin, () => toAdminReceipt(access))
    .when(
      () => PremiumAccessPolicy.isGrantOnly(access),
      () => toRewardReceipt(access, context),
    )
    .otherwise(() => toPaidReceipt(access, context));
}
