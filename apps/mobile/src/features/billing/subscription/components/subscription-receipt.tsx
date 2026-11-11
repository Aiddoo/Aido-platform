import { type Instant } from '@src/shared/date/instant';
import type { PlanType } from '@src/shared/domains/plan-type.model';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  Barcode,
  Box,
  DashedDivider,
  FillTicketIcon,
  HStack,
  IconCircle,
  ListRow,
  PawIcon,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { PLAN_PRICE_LABEL_KEYS } from '../constants/subscription-labels';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useFormatReceiptDate } from '../hooks/use-format-receipt-date';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { getPremiumBenefitAmounts } from '../utils/plan-benefit.view-model';
import {
  type SubscriptionReceiptRow,
  toReceiptDateLabel,
} from '../utils/subscription-receipt.view-model';
import { ReceiptBenefitRow } from './receipt-benefit-row';

export function SubscriptionReceipt() {
  const { t } = useTranslation('subscription');
  const { variant, rows, footnote } = useSubscriptionReceipt();
  const dateFormatContext = useDateFormatContext();
  const premium = getPremiumBenefitAmounts();
  const planPrices = usePlanPrices(
    rows.some((row) => row.type === 'firstBillingDate' || row.type === 'plan'),
  );
  const formatAmount = (value: number) => formatCount(value, dateFormatContext.locale);
  const trialPlanType =
    rows.find((row) => row.type === 'plan')?.planType ?? ('annual' satisfies PlanType);
  const formatReceiptDate = useFormatReceiptDate(toReceiptDateLabel(variant));

  return (
    <ScallopedContainer>
      {variant === 'reward' && (
        <IconCircle
          tone="brand"
          pointerEvents="none"
          className="absolute right-4 top-4 -rotate-6"
          icon={
            <>
              <Box className="absolute inset-1 rounded-full border border-dashed border-white/90 dark:border-gray-1/90" />
              <PawIcon width={20} height={20} colorClassName="text-white dark:text-gray-1" />
            </>
          }
        />
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
            <ReceiptDetailRow
              key={row.type}
              row={row}
              formatDate={formatReceiptDate}
              planPrices={planPrices}
              trialPlanType={trialPlanType}
            />
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
              .with({ type: 'rewardStartsOn' }, ({ days, date }) =>
                t('receipt.footnote.rewardStartsOn', {
                  count: days,
                  date: formatReceiptDate(date),
                }),
              )
              .with({ type: 'manageAutoRenewalInStore' }, () =>
                t('receipt.footnote.manageAutoRenewalInStore'),
              )
              .with({ type: 'cancelTrialInStore' }, () => t('receipt.footnote.cancelTrialInStore'))
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

/** 받은 뒤 높이가 바뀌지 않게 실제 영수증과 같은 줄 수와 자리를 잡는다. 줄 수는 가장 흔한 결제 영수증(다음 결제일, 자동 갱신)과 혜택 목록 줄 수다 */
const LOADING_DETAIL_ROW_COUNT = 2;
const BENEFIT_ROW_COUNT = 10;

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

        <VStack>
          {range(LOADING_DETAIL_ROW_COUNT).map((index) => (
            <ListRow
              key={index}
              verticalPadding="small"
              contents={<TextSkeleton size="b4" className="w-20" />}
              right={<TextSkeleton size="b4" className="w-28" />}
            />
          ))}
        </VStack>
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Box className="px-5">
        <TextSkeleton size="b3" className="mb-3 w-32" />
        <VStack gap={2}>
          {range(BENEFIT_ROW_COUNT).map((index) => (
            <ListRow
              key={index}
              verticalPadding="small"
              left={<Skeleton className="size-5 rounded-full dark:bg-gray-2" />}
              contents={<TextSkeleton size="b3" className="w-44" />}
            />
          ))}
        </VStack>
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Barcode className="px-5 pb-5" />
    </ScallopedContainer>
  );
};

/**
 * 서버는 금액을 몰라(국가별 스토어 가격) 스토어 요금제에서 붙인다.
 * 영수증은 스토어 없이 서버 값으로 그려야 해서 실패를 던지지 않고, 못 받으면 날짜·요금제 이름만 보인다
 */
function usePlanPrices(isEnabled: boolean): Record<PlanType, string | null> {
  const { t } = useTranslation('subscription');
  const { data: availability } = useQuery({
    ...useGetOfferingsQueryOptions(),
    enabled: isEnabled,
    throwOnError: false,
  });
  const plans = availability?.status === 'available' ? availability.offering.plans : [];
  const formatPlanPrice = (planType: PlanType) => {
    const plan = SubscriptionPolicy.findPlanByType(plans, planType);
    return plan == null ? null : t(PLAN_PRICE_LABEL_KEYS[planType], { price: plan.priceString });
  };

  return { annual: formatPlanPrice('annual'), monthly: formatPlanPrice('monthly') };
}

const PLAN_NAME_KEYS = {
  annual: 'plan.annual',
  monthly: 'plan.monthly',
} as const satisfies Record<PlanType, string>;

interface ReceiptDetailRowProps {
  row: SubscriptionReceiptRow;
  formatDate: (date: Instant) => string;
  planPrices: Record<PlanType, string | null>;
  /** 체험 뒤 첫 결제 금액에 쓸 요금제. 서버가 모르면 체험을 두는 연간이다(스토어 설정) */
  trialPlanType: PlanType;
}

type ReceiptValueTone = 'default' | 'brand' | 'muted';

function ReceiptDetailRow({ row, formatDate, planPrices, trialPlanType }: ReceiptDetailRowProps) {
  const { t } = useTranslation('subscription');
  const firstBillingPrice = planPrices[trialPlanType];
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
    .with({ type: 'plan' }, ({ planType }) => {
      const price = planType == null ? null : planPrices[planType];
      const name = t(planType == null ? 'receipt.rows.planUnknown' : PLAN_NAME_KEYS[planType]);
      return {
        label: t('receipt.rows.plan'),
        value: price == null ? name : t('receipt.rows.planWithPrice', { plan: name, price }),
        tone: 'default',
      };
    })
    .with({ type: 'nextBillingDate' }, ({ date }) => ({
      label: t('receipt.rows.nextBillingDate'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'trialEndsOn' }, ({ date }) => ({
      label: t('receipt.rows.trialEndsOn'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'firstBillingDate' }, ({ date }) => ({
      label: t('receipt.rows.firstBillingDate'),
      value:
        firstBillingPrice == null
          ? formatDate(date)
          : t('receipt.rows.dateWithPrice', { date: formatDate(date), price: firstBillingPrice }),
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
