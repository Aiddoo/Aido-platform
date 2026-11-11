import {
  PremiumAccessPolicy,
  type PremiumPlanType,
} from '@src/features/identity/user/domains/premium-access.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match, P } from 'ts-pattern';

import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import type { SubscriptionReceiptViewModel } from '../utils/subscription-receipt.view-model';

type PremiumNoticeProps = Pick<ComponentProps<typeof Text>, 'className'>;

/** 체험은 끝나기 며칠 전부터, 그 밖의 프리미엄은 이어질 길이 없을 때 하루 안에 끝나면 알린다 */
function Ending({ className }: PremiumNoticeProps) {
  const { t } = useTranslation('subscription');
  const receipt = useSubscriptionReceipt();
  const toDaysLeftBadge = (daysLeft: number) =>
    match(daysLeft)
      .with(0, () => t('endingNotice.badgeToday'))
      .with(1, () => t('endingNotice.badgeTomorrow'))
      .otherwise((days) => t('endingNotice.badgeDaysLeft', { days }));

  // 보상 기간은 구독 버튼으로, 취소한 결제 구독은 스토어에서 자동 갱신을 다시 켜서 이어 간다
  const notice = match(receipt)
    .with({ endingNotice: null }, () => null)
    .with({ variant: 'trial', endingNotice: P.nonNullable }, ({ endingNotice }) => ({
      badge: toDaysLeftBadge(endingNotice.daysLeft),
      message: t(getTrialEndingMessageKey(endingNotice), {
        days: endingNotice.daysLeft,
        plan: t(PLAN_NAME_KEYS[endingNotice.planType ?? 'unknown']),
      }),
    }))
    .with(
      { variant: 'paid', endingNotice: { type: 'annualRenewing' } },
      ({ endingNotice: { daysLeft } }) => ({
        badge: toDaysLeftBadge(daysLeft),
        message: match(daysLeft)
          .with(0, () => t('endingNotice.annualRenewingToday'))
          .with(1, () => t('endingNotice.annualRenewingTomorrow'))
          .otherwise((days) => t('endingNotice.annualRenewing', { days })),
      }),
    )
    .with({ variant: 'paid', endingNotice: 'today' }, () => ({
      badge: t('endingNotice.badgeToday'),
      message: t('endingNotice.paidToday'),
    }))
    .with({ variant: 'paid', endingNotice: 'tomorrow' }, () => ({
      badge: t('endingNotice.badgeTomorrow'),
      message: t('endingNotice.paidTomorrow'),
    }))
    .with({ variant: 'reward', endingNotice: 'today' }, () => ({
      badge: t('endingNotice.badgeToday'),
      message: t('endingNotice.today'),
    }))
    .with({ variant: 'reward', endingNotice: 'tomorrow' }, () => ({
      badge: t('endingNotice.badgeTomorrow'),
      message: t('endingNotice.tomorrow'),
    }))
    .exhaustive();

  if (notice == null) {
    return null;
  }
  const { badge, message } = notice;

  return (
    <InlineAlert
      status="accent"
      accessibilityRole="summary"
      className={cn('rounded-2xl bg-main/10', className)}
      testID="subscription-ending-notice"
      image={
        <Chip size="sm" pointerEvents="none" className="self-center bg-main">
          <Text size="e1" weight="bold" className="text-white tabular-nums dark:text-gray-1">
            {badge}
          </Text>
        </Chip>
      }
      title={message}
    />
  );
}

const PLAN_NAME_KEYS = {
  annual: 'endingNotice.plan.annual',
  monthly: 'endingNotice.plan.monthly',
  unknown: 'endingNotice.plan.unknown',
} as const satisfies Record<PremiumPlanType | 'unknown', string>;

type TrialEndingNotice = NonNullable<
  Extract<SubscriptionReceiptViewModel, { variant: 'trial' }>['endingNotice']
>;

/** 자동 갱신이 켜져 있으면 결제가, 꺼져 있으면 체험 끝이 사용자가 알아야 할 일이다 */
function getTrialEndingMessageKey({ daysLeft, willRenew }: TrialEndingNotice) {
  return match({ daysLeft, willRenew })
    .with({ willRenew: true, daysLeft: 0 }, () => 'endingNotice.trialRenewingToday' as const)
    .with({ willRenew: true, daysLeft: 1 }, () => 'endingNotice.trialRenewingTomorrow' as const)
    .with({ willRenew: true }, () => 'endingNotice.trialRenewing' as const)
    .with({ willRenew: false, daysLeft: 0 }, () => 'endingNotice.trialCancelledToday' as const)
    .with({ willRenew: false, daysLeft: 1 }, () => 'endingNotice.trialCancelledTomorrow' as const)
    .with({ willRenew: false }, () => 'endingNotice.trialCancelled' as const)
    .exhaustive();
}

function GrantEnded({ className }: PremiumNoticeProps) {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const grantEndedAt = PremiumAccessPolicy.getRecentGrantEndedAt(user.premiumAccess);

  if (grantEndedAt == null) {
    return null;
  }

  return (
    <Text
      size="b4"
      shade={7}
      align="center"
      lineBreakStrategyIOS="hangul-word"
      className={cn('rounded-2xl bg-gray-1 px-4 py-3', className)}
    >
      {t('paywall.grantEnded', {
        date: formatYearAwareDateLabel(grantEndedAt, todayKey, dateFormatContext),
      })}
    </Text>
  );
}

export const PremiumNotice = {
  Ending,
  GrantEnded,
} as const;
