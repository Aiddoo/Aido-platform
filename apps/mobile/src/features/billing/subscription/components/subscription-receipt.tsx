import { formatDateLabel } from '@src/shared/date/date-format';
import type { Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  Barcode,
  Box,
  DashedDivider,
  FillTicketIcon,
  HStack,
  ListRow,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/format';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { toPremiumBenefitAmounts } from '../utils/plan-benefit.view-model';
import type { SubscriptionReceiptRow } from '../utils/subscription-receipt.view-model';
import { ReceiptBenefitRow } from './receipt-benefit-row';

interface SubscriptionReceiptProps {
  /** 보상 기간 영수증 모서리에 찍는 장식. 어떤 도장인지는 화면이 정한다 */
  rewardStamp?: ReactNode;
}

export function SubscriptionReceipt({ rewardStamp }: SubscriptionReceiptProps) {
  const { t } = useTranslation('subscription');
  const { variant, rows, footnote } = useSubscriptionReceipt();
  const dateFormatContext = useDateFormatContext();
  const premium = toPremiumBenefitAmounts();
  const formatAmount = (value: number) => formatCount(value, dateFormatContext.locale);
  // 결제 기간은 해를 넘길 수 있어 연도까지, 보상 기간은 길어야 몇 달이라 월·일만 보인다
  const receiptDateLabel = variant === 'paid' ? 'fullDate' : 'monthDay';
  const formatReceiptDate = (date: Instant) =>
    formatDateLabel(date, receiptDateLabel, dateFormatContext);

  return (
    <ScallopedContainer>
      {variant === 'reward' && rewardStamp != null && (
        <Box className="absolute right-4 top-4">{rewardStamp}</Box>
      )}

      <Box className="px-5 pt-5" testID={`subscription-receipt-${variant}`}>
        <HStack gap={16} className="items-center">
          <FillTicketIcon width={40} height={40} />

          {/* 도장 자리를 비워 두어 긴 제목이 도장 아래로 들어가지 않게 한다 */}
          <VStack gap={2} className={cn('flex-1', variant === 'reward' && 'pr-10')}>
            {/* 가장 큰 글자에서 "이/용 중"처럼 단어 중간에서 끊기지 않게 어절 단위로 줄바꿈한다 */}
            <Text
              size="t3"
              weight="bold"
              tone="brand"
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="highQuality"
            >
              {t(`receipt.${variant}.title`)}
            </Text>

            <Text
              size="b4"
              shade={6}
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="highQuality"
            >
              {t(`receipt.${variant}.description`)}
            </Text>
          </VStack>
        </HStack>

        <Spacing size={24} />

        <VStack>
          {rows.map((row) => (
            <ReceiptDetailRow key={row.type} row={row} formatDate={formatReceiptDate} />
          ))}
        </VStack>

        {footnote != null && (
          <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word" className="mt-2">
            {match(footnote)
              .with({ type: 'returnsToFreePlan' }, ({ date }) =>
                t('receipt.footnote.returnsToFreePlan', { date: formatReceiptDate(date) }),
              )
              .with({ type: 'rewardStartsAfterSubscription' }, ({ days }) =>
                t('receipt.footnote.rewardStartsAfterSubscription', { count: days }),
              )
              .with({ type: 'manageAutoRenewalInStore' }, () =>
                t('receipt.footnote.manageAutoRenewalInStore'),
              )
              .exhaustive()}
          </Text>
        )}
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Box className="px-5">
        <Text size="b3" weight="semibold" shade={9} className="mb-3">
          {t('subscriber.benefitsTitle')}
        </Text>

        <VStack gap={2}>
          <ReceiptBenefitRow shade={8} title={t('benefits.aiParsing.title')} />
          <ReceiptBenefitRow
            shade={8}
            title={t('benefits.voiceNote.title', {
              premium: formatAmount(premium.voiceNote),
              premiumMinutes: formatAmount(premium.voiceNoteMinutes),
            })}
          />
          <ReceiptBenefitRow shade={8} title={t('benefits.nudge.title')} />
          <ReceiptBenefitRow shade={8} title={t('benefits.reminder.title')} />
          <ReceiptBenefitRow shade={8} title={t('benefits.appIcon.title')} />
          <ReceiptBenefitRow shade={8} title={t('benefits.friends.title')} />
          <ReceiptBenefitRow
            shade={8}
            title={t('benefits.categories.title', { premium: formatAmount(premium.category) })}
          />
          <ReceiptBenefitRow shade={8} title={t('benefits.aiRepeat.title')} />
          <ReceiptBenefitRow shade={8} title={t('benefits.aiReport.title')} />
          <ReceiptBenefitRow shade={8} title={t('benefits.future')} />
        </VStack>
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Barcode className="px-5 pb-5" />
    </ScallopedContainer>
  );
}

SubscriptionReceipt.Loading = function Loading() {
  return (
    <ScallopedContainer>
      <Box className="px-5 pt-5">
        <HStack gap={16} className="items-center">
          <Skeleton className="size-10 rounded-lg dark:bg-gray-2" />
          <VStack gap={2} className="flex-1">
            <TextSkeleton size="t3" className="w-40" />
            <TextSkeleton size="b4" className="w-52" />
          </VStack>
        </HStack>

        <Spacing size={24} />

        <VStack gap={12}>
          {range(3).map((index) => (
            <HStack key={index} justify="between">
              <TextSkeleton size="b3" className="w-20" />
              <TextSkeleton size="b3" className="w-28" />
            </HStack>
          ))}
        </VStack>
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Box className="px-5 pb-5">
        <TextSkeleton size="b3" className="mb-3 w-32" />
        <VStack gap={10}>
          {range(4).map((index) => (
            <HStack key={index} gap={12} align="center">
              <Skeleton className="size-5 rounded-full dark:bg-gray-2" />
              <TextSkeleton size="b3" className="w-44" />
            </HStack>
          ))}
        </VStack>
      </Box>
    </ScallopedContainer>
  );
};

interface ReceiptDetailRowProps {
  row: SubscriptionReceiptRow;
  formatDate: (date: Instant) => string;
}

type ReceiptValueTone = 'default' | 'brand' | 'muted';

function ReceiptDetailRow({ row, formatDate }: ReceiptDetailRowProps) {
  const { t } = useTranslation('subscription');
  const { label, value, tone } = match<
    SubscriptionReceiptRow,
    { label: string; value: string; tone: ReceiptValueTone }
  >(row)
    .with({ type: 'account' }, () => ({
      label: t('receipt.rows.account'),
      value: t('receipt.rows.accountAdmin'),
      tone: 'default',
    }))
    .with({ type: 'rewardRecord' }, ({ endsAt }) => ({
      label: t('receipt.rows.rewardRecord'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'nextBillingDate' }, ({ date }) => ({
      label: t('receipt.rows.nextBillingDate'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'renewalPending' }, () => ({
      label: t('receipt.rows.nextBillingDate'),
      value: t('receipt.rows.renewalPending'),
      tone: 'muted',
    }))
    .with({ type: 'subscriptionEndsOn' }, ({ date }) => ({
      label: t('receipt.rows.subscriptionEndsOn'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'autoRenewal' }, ({ willRenew }) => ({
      label: t('receipt.rows.subscriptionStatus'),
      value: willRenew ? t('receipt.rows.autoRenewalOn') : t('receipt.rows.autoRenewalOff'),
      tone: willRenew ? 'brand' : 'muted',
    }))
    .with({ type: 'rewardPeriod' }, ({ endsAt }) => ({
      label: t('receipt.rows.rewardPeriod'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'bankedReward' }, ({ days, endsAt }) => ({
      label: t('receipt.rows.bankedReward'),
      value:
        endsAt == null
          ? t('receipt.rows.days', { count: days })
          : t('receipt.rows.daysUntil', { count: days, date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'overallPeriod' }, ({ endsAt }) => ({
      label: t('receipt.rows.overallPeriod'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'daysLeft' }, ({ days, endingNotice }) => ({
      label: t('receipt.rows.daysLeft'),
      value: match(endingNotice)
        .with('today', () => t('endingNotice.badgeToday'))
        .with('tomorrow', () => t('endingNotice.badgeTomorrow'))
        .with(null, () => t('receipt.rows.days', { count: days }))
        .exhaustive(),
      tone: endingNotice == null ? 'default' : 'brand',
    }))
    .exhaustive();

  return (
    <ListRow
      verticalPadding="small"
      testID={`subscription-receipt-row-${row.type}`}
      contents={
        <Text size="b4" shade={6}>
          {label}
        </Text>
      }
      right={
        <Text
          size="b4"
          weight="semibold"
          tone={tone === 'brand' ? 'brand' : 'neutral'}
          shade={tone === 'muted' ? 6 : 8}
          className="tabular-nums"
        >
          {value}
        </Text>
      }
    />
  );
}
