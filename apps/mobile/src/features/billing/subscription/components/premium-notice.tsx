import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';

/** 자동 갱신도 이어서 받을 보상도 없는 프리미엄이 하루 안에 끝나면 구독으로 이어 가도록 알린다 */
type PremiumNoticeProps = Pick<ComponentProps<typeof Text>, 'className'>;

function Ending({ className }: PremiumNoticeProps) {
  const { t } = useTranslation('subscription');
  const receipt = useSubscriptionReceipt();

  if (receipt.endingNotice == null) {
    return null;
  }
  const { variant, endingNotice } = receipt;

  // 보상 기간은 구독 버튼으로, 취소한 결제 구독은 스토어에서 자동 갱신을 다시 켜서 이어 간다
  const { badge, message } = match({ variant, endingNotice })
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

  return (
    <InlineAlert
      status="accent"
      accessibilityRole="summary"
      className={cn('rounded-2xl bg-main/10', className)}
      testID="subscription-ending-notice"
      image={
        <Chip className="self-center rounded-full bg-main px-2 py-0.5">
          <Text size="e1" weight="bold" className="text-white tabular-nums dark:text-gray-1">
            {badge}
          </Text>
        </Chip>
      }
      title={message}
    />
  );
}

function GrantEnded({ className }: PremiumNoticeProps) {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const dateFormatContext = useDateFormatContext();
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
        date: formatDateLabel(grantEndedAt, 'monthDay', dateFormatContext),
      })}
    </Text>
  );
}

export const PremiumNotice = {
  Ending,
  GrantEnded,
} as const;
