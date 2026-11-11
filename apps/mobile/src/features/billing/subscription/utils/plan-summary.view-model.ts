import type { PremiumPlanType } from '@src/features/identity/user/domains/premium-access.model';
import { type Instant } from '@src/shared/date/instant';
import { match, P } from 'ts-pattern';

import {
  type SubscriptionReceiptRow,
  type SubscriptionReceiptViewModel,
  toReceiptDateLabel,
} from './subscription-receipt.view-model';

type PlanSummaryHeadline =
  | { type: 'subscription'; planType: PremiumPlanType | null }
  | { type: 'trial' }
  | { type: 'reward' }
  | { type: 'admin' };

type PlanSummaryPeriod =
  | { type: 'renewalPending' }
  | { type: 'nextBilling'; date: Instant }
  | { type: 'firstBilling'; date: Instant }
  | { type: 'endsOn'; date: Instant };

type PlanSummaryNote =
  | { type: 'rewardStartsAfterSubscription'; days: number }
  | { type: 'rewardStartsOn'; days: number; date: Instant };

interface PlanSummary {
  headline: PlanSummaryHeadline;
  dateLabel: ReturnType<typeof toReceiptDateLabel>;
  period: PlanSummaryPeriod | null;
  note: PlanSummaryNote | null;
}

function findPlanType(rows: readonly SubscriptionReceiptRow[]) {
  return match(rows.find((row) => row.type === 'plan'))
    .with({ type: 'plan' }, ({ planType }) => planType)
    .otherwise(() => null);
}

/** 영수증 줄 가운데 다음에 일어날 일 하나. 결제일이 먼저고 없으면 끝나는 날이다 */
function findPeriod(rows: readonly SubscriptionReceiptRow[]): PlanSummaryPeriod | null {
  for (const row of rows) {
    const period = match(row)
      .returnType<PlanSummaryPeriod | null>()
      .with({ type: 'renewalPending' }, () => ({ type: 'renewalPending' }))
      .with({ type: 'nextBillingDate' }, ({ date }) => ({ type: 'nextBilling', date }))
      .with({ type: 'firstBillingDate' }, ({ date }) => ({ type: 'firstBilling', date }))
      .with({ type: 'subscriptionEndsOn' }, ({ date }) => ({ type: 'endsOn', date }))
      .with({ type: 'rewardPeriod' }, ({ endsAt }) => ({ type: 'endsOn', date: endsAt }))
      .otherwise(() => null);
    if (period != null) {
      return period;
    }
  }
  return null;
}

/** 마이 탭 요금제 요약. 새 규칙 없이 영수증 view-model 결과에서 제목·다음 날짜·보상 안내만 고른다 */
export function toPlanSummary(receipt: SubscriptionReceiptViewModel): PlanSummary {
  return {
    headline: match(receipt.variant)
      .returnType<PlanSummaryHeadline>()
      .with('paid', () => ({ type: 'subscription', planType: findPlanType(receipt.rows) }))
      .with('trial', () => ({ type: 'trial' }))
      .with('reward', () => ({ type: 'reward' }))
      .with('admin', () => ({ type: 'admin' }))
      .exhaustive(),
    dateLabel: toReceiptDateLabel(receipt.variant),
    period: findPeriod(receipt.rows),
    note: match(receipt.footnote)
      .returnType<PlanSummaryNote | null>()
      .with({ type: P.union('rewardStartsAfterSubscription', 'rewardStartsOn') }, (note) => note)
      .otherwise(() => null),
  };
}
