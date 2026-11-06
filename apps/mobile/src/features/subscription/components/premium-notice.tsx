import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Spacing, Text } from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';

/** 자동 갱신도 이어서 받을 보상도 없는 프리미엄이 하루 안에 끝나면 구독으로 이어 가도록 알린다 */
function Ending() {
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
    <>
      <HStack
        gap={10}
        align="center"
        accessibilityRole="summary"
        className="rounded-2xl bg-main/10 px-3.5 py-3"
        testID="subscription-ending-notice"
      >
        <Box className="rounded-full bg-main px-2 py-0.5">
          <Text size="e1" weight="bold" className="text-white tabular-nums dark:text-gray-1">
            {badge}
          </Text>
        </Box>
        <Text
          size="b4"
          weight="semibold"
          tone="brand"
          lineBreakStrategyIOS="hangul-word"
          className="flex-1"
        >
          {message}
        </Text>
      </HStack>
      <Spacing size={12} />
    </>
  );
}

function GrantEnded() {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const grantEndedAt = PremiumAccessPolicy.recentGrantEndedAt(user.premiumAccess);

  if (grantEndedAt == null) {
    return null;
  }

  return (
    <>
      <Text
        size="b4"
        shade={7}
        align="center"
        lineBreakStrategyIOS="hangul-word"
        className="rounded-2xl bg-gray-1 px-4 py-3"
      >
        {t('paywall.grantEnded', {
          date: formatDateLabel(grantEndedAt, 'monthDay', dateFormatContext),
        })}
      </Text>
      <Spacing size={12} />
    </>
  );
}

export const PremiumNotice = {
  Ending,
  GrantEnded,
} as const;
