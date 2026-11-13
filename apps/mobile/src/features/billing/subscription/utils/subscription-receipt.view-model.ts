import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { type PremiumAccess } from '@src/features/identity/user/domains/premium-access.model';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import { type User } from '@src/features/identity/user/domains/user.model';
import { type Instant } from '@src/shared/date/instant';
import type { PlanType } from '@src/shared/domains/plan-type.model';
import { match } from 'ts-pattern';

/** 곧 끝난다는 안내를 어느 날로 보일지. 끝나는 날이면 today, 하루 남았으면 tomorrow다 */
type PremiumEndingNotice = 'tomorrow' | 'today';

/** 자동 갱신되는 연간 구독이 서버 갱신 알림과 같은 날수 안에 결제된다 */
interface AnnualRenewingNotice {
  type: 'annualRenewing';
  daysLeft: number;
}

/** 체험 끝까지 남은 날과 그날 결제되는지. 결제 여부로 "구독이 시작돼요"/"체험이 끝나요"가 갈린다 */
interface TrialEndingNotice {
  daysLeft: number;
  willRenew: boolean;
  /** 체험 뒤 이어질 요금제. 모르면 요금제 없이 "구독"으로 말한다 */
  planType: PlanType | null;
}

/** 서버가 준 보상 일수 중 구독 뒤로 쌓인 것. 끝나는 날은 자동 갱신 중이면 밀려서 모른다 */
interface BankedReward {
  days: number;
  endsAt: Instant | null;
}

type PaidBilling =
  | { type: 'nextBillingDate'; date: Instant }
  /** 결제 예정 시각이 지났는데 스토어 갱신이 아직 서버에 반영되지 않았다(최대 유예 3시간) */
  | { type: 'renewalPending' }
  | { type: 'subscriptionEndsOn'; date: Instant };

type TrialBilling =
  | { type: 'renewalPending' }
  /** 금액은 서버가 모르므로 화면이 스토어 요금제에서 붙인다 */
  | { type: 'firstBillingDate'; date: Instant };

interface AdminReceiptDetails {
  rewardRecordEndsAt: Instant | null;
  bankedDays: number | null;
}

interface PaidReceiptDetails {
  /** 지금 구독의 요금제. 모르면 null이고 "구독"으로 보인다 */
  planType: PlanType | null;
  billing: PaidBilling;
  willRenew: boolean;
  banked: BankedReward | null;
}

interface TrialReceiptDetails {
  /** 체험 뒤 이어질 요금제. 모르면 null이고 "구독"으로 보인다 */
  planType: PlanType | null;
  trialEndsOn: Instant;
  billing: TrialBilling | null;
  willRenew: boolean;
  banked: BankedReward | null;
}

interface RewardReceiptDetails {
  periodEndsAt: Instant;
  /** 쌓아 둔 보상이 있으면 이어서 받을 일수와 전체 이용 기간 끝 */
  chained: { bankedDays: number; overallEndsAt: Instant } | null;
  daysLeft: { days: number; endingNotice: PremiumEndingNotice | null };
}

/** 영수증 아래 한 줄. "그다음엔 어떻게 되나"가 행만으로 드러나지 않을 때만 붙인다 */
type SubscriptionReceiptFootnote =
  | { type: 'returnsToFreePlan'; date: Instant }
  | { type: 'rewardStartsAfterSubscription'; days: number }
  /** 자동 갱신이 꺼져 구독 끝이 정해졌으면 보상이 이어지는 날까지 보인다 */
  | { type: 'rewardStartsOn'; days: number; date: Instant }
  | { type: 'manageAutoRenewalInStore' }
  | { type: 'cancelTrialInStore' };

type SubscriptionReceiptAction = 'subscribe' | 'manage';

interface SubscriptionReceiptContents {
  footnote: SubscriptionReceiptFootnote | null;
  primaryAction: SubscriptionReceiptAction | null;
}

/** 영수증 출처는 관리자, 스토어 구독(결제·무료 체험), 초대 보상 기간이다. 관리자는 기간이 끝나도 모든 기능을 쓰므로 끝남 안내가 없다 */
export type SubscriptionReceiptViewModel =
  | (SubscriptionReceiptContents & {
      variant: 'admin';
      details: AdminReceiptDetails;
      endingNotice: null;
    })
  | (SubscriptionReceiptContents & {
      variant: 'paid';
      /** 기간이 없으면 null이고 영수증은 줄 없이 머리만 보인다 */
      details: PaidReceiptDetails | null;
      endingNotice: PremiumEndingNotice | AnnualRenewingNotice | null;
    })
  | (SubscriptionReceiptContents & {
      variant: 'reward';
      details: RewardReceiptDetails | null;
      endingNotice: PremiumEndingNotice | null;
    })
  | (SubscriptionReceiptContents & {
      variant: 'trial';
      details: TrialReceiptDetails | null;
      endingNotice: TrialEndingNotice | null;
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

function toBankedReward(access: PremiumAccess, endsAt: Instant | null): BankedReward | null {
  return PremiumAccessPolicy.hasBankedDays(access) ? { days: access.bankedDays, endsAt } : null;
}

function toAdminReceipt(access: PremiumAccess): SubscriptionReceiptViewModel {
  return {
    variant: 'admin',
    details: {
      rewardRecordEndsAt:
        PremiumAccessPolicy.isGrantOnly(access) && access.endsAt != null ? access.endsAt : null,
      bankedDays: PremiumAccessPolicy.hasBankedDays(access) ? access.bankedDays : null,
    },
    footnote: null,
    primaryAction: null,
    endingNotice: null,
  };
}

function toPaidBilling(access: PremiumAccess, periodEndsAt: Instant, now: Instant): PaidBilling {
  if (!access.willRenew) {
    return { type: 'subscriptionEndsOn', date: periodEndsAt };
  }
  return PremiumAccessPolicy.isRenewalPending(access, now)
    ? { type: 'renewalPending' }
    : { type: 'nextBillingDate', date: periodEndsAt };
}

// 자동 갱신 중이면 보상이 시작하는 날이 갱신마다 밀려 날짜 없이 일수만 보인다(시작 시점은 footnote가 설명한다)
function toPaidDetails(access: PremiumAccess, now: Instant): PaidReceiptDetails | null {
  const { periodEndsAt } = access;
  if (periodEndsAt == null) {
    return null;
  }

  return {
    planType: access.planType,
    billing: toPaidBilling(access, periodEndsAt, now),
    willRenew: access.willRenew,
    banked: toBankedReward(access, access.willRenew ? null : access.endsAt),
  };
}

function toBankedRewardFootnote(access: PremiumAccess): SubscriptionReceiptFootnote {
  const startsAt = PremiumAccessPolicy.getBankedRewardStartsAt(access);
  return startsAt == null
    ? { type: 'rewardStartsAfterSubscription', days: access.bankedDays }
    : { type: 'rewardStartsOn', days: access.bankedDays, date: startsAt };
}

function toPaidFootnote(access: PremiumAccess): SubscriptionReceiptFootnote | null {
  if (PremiumAccessPolicy.hasBankedDays(access)) {
    return toBankedRewardFootnote(access);
  }

  if (access.willRenew) {
    return { type: 'manageAutoRenewalInStore' };
  }

  return access.endsAt == null ? null : { type: 'returnsToFreePlan', date: access.endsAt };
}

/** 이어질 길이 없이 끝나는 안내가 먼저고, 자동 갱신 중인 연간 구독이면 결제 며칠 전에 알린다 */
function toPaidEndingNotice(
  access: PremiumAccess,
  { now, timeZone }: Pick<SubscriptionReceiptContext, 'now' | 'timeZone'>,
): PremiumEndingNotice | AnnualRenewingNotice | null {
  const endingNotice = toEndingNotice(access, { now, timeZone });
  if (endingNotice != null) {
    return endingNotice;
  }
  const renewalDaysLeft = PremiumAccessPolicy.getAnnualRenewalDaysLeft(access, now, timeZone);
  return renewalDaysLeft == null ? null : { type: 'annualRenewing', daysLeft: renewalDaysLeft };
}

function toPaidReceipt(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  return {
    variant: 'paid',
    details: toPaidDetails(access, now),
    footnote: toPaidFootnote(access),
    primaryAction: 'manage',
    endingNotice: toPaidEndingNotice(access, { now, timeZone }),
  };
}

function toTrialBilling(
  access: PremiumAccess,
  periodEndsAt: Instant,
  now: Instant,
): TrialBilling | null {
  if (!access.willRenew) {
    return null;
  }
  return PremiumAccessPolicy.isRenewalPending(access, now)
    ? { type: 'renewalPending' }
    : { type: 'firstBillingDate', date: periodEndsAt };
}

function toTrialDetails(access: PremiumAccess, now: Instant): TrialReceiptDetails | null {
  const { periodEndsAt } = access;
  if (periodEndsAt == null) {
    return null;
  }

  return {
    planType: access.planType,
    trialEndsOn: periodEndsAt,
    billing: toTrialBilling(access, periodEndsAt, now),
    willRenew: access.willRenew,
    banked: toBankedReward(access, access.willRenew ? null : access.endsAt),
  };
}

/** 체험 중엔 "언제까지 해지하면 결제되지 않나"가 가장 궁금해 보상 안내보다 먼저 보인다(보상 일수는 행에 있다) */
function toTrialFootnote(access: PremiumAccess): SubscriptionReceiptFootnote | null {
  if (access.willRenew) {
    return { type: 'cancelTrialInStore' };
  }
  if (PremiumAccessPolicy.hasBankedDays(access)) {
    return toBankedRewardFootnote(access);
  }
  return access.endsAt == null ? null : { type: 'returnsToFreePlan', date: access.endsAt };
}

function toTrialEndingNotice(
  access: PremiumAccess,
  { now, timeZone }: Pick<SubscriptionReceiptContext, 'now' | 'timeZone'>,
): TrialEndingNotice | null {
  const daysLeft = PremiumAccessPolicy.getTrialDaysLeft(access, now, timeZone);
  if (daysLeft == null || !PremiumAccessPolicy.isTrialEndingSoon(access, now, timeZone)) {
    return null;
  }
  return { daysLeft, willRenew: access.willRenew, planType: access.planType };
}

function toTrialReceipt(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  return {
    variant: 'trial',
    details: toTrialDetails(access, now),
    footnote: toTrialFootnote(access),
    primaryAction: 'manage',
    endingNotice: toTrialEndingNotice(access, { now, timeZone }),
  };
}

function toRewardDetails(
  access: PremiumAccess,
  { now, timeZone }: SubscriptionReceiptContext,
): RewardReceiptDetails | null {
  const { endsAt, periodEndsAt } = access;
  const daysLeft = PremiumAccessPolicy.getDaysLeft(access, now, timeZone);
  if (endsAt == null || periodEndsAt == null || daysLeft == null) {
    return null;
  }

  return {
    periodEndsAt,
    chained: PremiumAccessPolicy.hasBankedDays(access)
      ? { bankedDays: access.bankedDays, overallEndsAt: endsAt }
      : null,
    daysLeft: { days: daysLeft, endingNotice: toEndingNotice(access, { now, timeZone }) },
  };
}

function toRewardReceipt(
  access: PremiumAccess,
  context: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  return {
    variant: 'reward',
    details: toRewardDetails(access, context),
    footnote: access.endsAt == null ? null : { type: 'returnsToFreePlan', date: access.endsAt },
    primaryAction: context.isStoreConfigured ? 'subscribe' : null,
    endingNotice: toEndingNotice(access, context),
  };
}

/** 스토어 구독(체험 포함)의 결제일은 늘 연도까지, 보상 기간은 올해가 아닐 때만 연도를 붙인다 */
export function toReceiptDateLabel(variant: SubscriptionReceiptViewModel['variant']) {
  return variant === 'paid' || variant === 'trial' ? ('fullDate' as const) : ('yearAware' as const);
}

/** 출처·기간·자동 갱신·이어서 받을 보상은 서버 값을 쓰고 여기서는 기기 시간대 기준 남은 일수와 보일 행만 고른다 */
export function toSubscriptionReceiptViewModel(
  user: User,
  context: SubscriptionReceiptContext,
): SubscriptionReceiptViewModel {
  const access = user.premiumAccess;

  return match(user)
    .when(UserPolicy.isAdmin, () => toAdminReceipt(access))
    .when(
      () => PremiumAccessPolicy.isGrantOnly(access),
      () => toRewardReceipt(access, context),
    )
    .when(
      () => PremiumAccessPolicy.isTrial(access),
      () => toTrialReceipt(access, context),
    )
    .otherwise(() => toPaidReceipt(access, context));
}
