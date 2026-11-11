import { type Instant } from '@src/shared/date/instant';
import type { PlanType } from '@src/shared/domains/plan-type.model';
import { match, P } from 'ts-pattern';

import {
  type SubscriptionReceiptViewModel,
  toReceiptDateLabel,
} from './subscription-receipt.view-model';

type PlanSummaryHeadline =
  | { type: 'subscription'; planType: PlanType | null }
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

function findPlanType(receipt: SubscriptionReceiptViewModel) {
  return match(receipt)
    .with({ variant: 'paid', details: P.nonNullable }, ({ details }) => details.planType)
    .otherwise(() => null);
}

/** 영수증 줄 가운데 다음에 일어날 일 하나. 결제일이 먼저고 없으면 끝나는 날이다 */
function findPeriod(receipt: SubscriptionReceiptViewModel): PlanSummaryPeriod | null {
  return match(receipt)
    .returnType<PlanSummaryPeriod | null>()
    .with({ variant: 'paid', details: { billing: { type: 'renewalPending' } } }, () => ({
      type: 'renewalPending',
    }))
    .with(
      { variant: 'paid', details: { billing: { type: 'nextBillingDate' } } },
      ({ details }) => ({
        type: 'nextBilling',
        date: details.billing.date,
      }),
    )
    .with(
      { variant: 'paid', details: { billing: { type: 'subscriptionEndsOn' } } },
      ({ details }) => ({
        type: 'endsOn',
        date: details.billing.date,
      }),
    )
    .with({ variant: 'trial', details: { billing: { type: 'renewalPending' } } }, () => ({
      type: 'renewalPending',
    }))
    .with(
      { variant: 'trial', details: { billing: { type: 'firstBillingDate' } } },
      ({ details }) => ({
        type: 'firstBilling',
        date: details.billing.date,
      }),
    )
    .with({ variant: 'reward', details: P.nonNullable }, ({ details }) => ({
      type: 'endsOn',
      date: details.periodEndsAt,
    }))
    .otherwise(() => null);
}

/** 마이 탭 요금제 요약. 새 규칙 없이 영수증 view-model 결과에서 제목·다음 날짜·보상 안내만 고른다 */
export function toPlanSummary(receipt: SubscriptionReceiptViewModel): PlanSummary {
  return {
    headline: match(receipt.variant)
      .returnType<PlanSummaryHeadline>()
      .with('paid', () => ({ type: 'subscription', planType: findPlanType(receipt) }))
      .with('trial', () => ({ type: 'trial' }))
      .with('reward', () => ({ type: 'reward' }))
      .with('admin', () => ({ type: 'admin' }))
      .exhaustive(),
    dateLabel: toReceiptDateLabel(receipt.variant),
    period: findPeriod(receipt),
    note: match(receipt.footnote)
      .returnType<PlanSummaryNote | null>()
      .with({ type: P.union('rewardStartsAfterSubscription', 'rewardStartsOn') }, (note) => note)
      .otherwise(() => null),
  };
}
