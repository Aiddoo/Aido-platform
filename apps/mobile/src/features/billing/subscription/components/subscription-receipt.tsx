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
import { match, P } from 'ts-pattern';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useFormatReceiptDate } from '../hooks/use-format-receipt-date';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { getPremiumBenefitAmounts } from '../utils/plan-benefit.view-model';
import { getPlanNameKey, getPlanPriceLabelKey } from '../utils/subscription-label.view-model';
import {
  type SubscriptionReceiptViewModel,
  toReceiptDateLabel,
} from '../utils/subscription-receipt.view-model';
import { ReceiptBenefitRow } from './receipt-benefit-row';

export function SubscriptionReceipt() {
  const { t } = useTranslation('subscription');
  const receipt = useSubscriptionReceipt();
  const { variant, footnote } = receipt;
  const dateFormatContext = useDateFormatContext();
  const premium = getPremiumBenefitAmounts();
  const planPrices = usePlanPrices({
    isEnabled: (variant === 'paid' || variant === 'trial') && receipt.details != null,
  });
  const formatAmount = (value: number) => formatCount(value, dateFormatContext.locale);
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

        <ReceiptRows receipt={receipt} formatDate={formatReceiptDate} planPrices={planPrices} />

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
function usePlanPrices({ isEnabled }: { isEnabled: boolean }): Record<PlanType, string | null> {
  const { t } = useTranslation('subscription');
  const { data: availability } = useQuery({
    ...useGetOfferingsQueryOptions(),
    enabled: isEnabled,
    throwOnError: false,
  });
  const plans = availability?.status === 'available' ? availability.offering.plans : [];
  const formatPlanPrice = (planType: PlanType) => {
    const plan = SubscriptionPolicy.findPlanByType(plans, planType);
    return plan == null ? null : t(getPlanPriceLabelKey(planType), { price: plan.priceString });
  };

  return { annual: formatPlanPrice('annual'), monthly: formatPlanPrice('monthly') };
}

interface ReceiptRowsProps {
  receipt: SubscriptionReceiptViewModel;
  formatDate: (date: Instant) => string;
  planPrices: Record<PlanType, string | null>;
}

/** 출처마다 보이는 줄과 순서가 달라 줄을 한 줄씩 적는다. 없는 줄은 값이 없을 때만 빠진다 */
function ReceiptRows({ receipt, formatDate, planPrices }: ReceiptRowsProps) {
  const { t } = useTranslation('subscription');

  return match(receipt)
    .with({ variant: 'admin' }, ({ details }) => (
      <VStack>
        <Row
          type="account"
          label={t('receipt.rows.account')}
          value={t('receipt.rows.accountAdmin')}
        />
        {details.rewardRecordEndsAt != null && (
          <Row
            type="rewardRecord"
            label={t('receipt.rows.rewardRecord')}
            value={t('receipt.rows.until', { date: formatDate(details.rewardRecordEndsAt) })}
          />
        )}
        {details.bankedDays != null && (
          <Row
            type="bankedReward"
            label={t('receipt.rows.bankedReward')}
            value={t('receipt.rows.days', { count: details.bankedDays })}
          />
        )}
      </VStack>
    ))
    .with({ variant: 'paid', details: null }, { variant: 'trial', details: null }, () => <VStack />)
    .with({ variant: 'paid', details: P.nonNullable }, ({ details }) => (
      <VStack>
        <PlanRow planType={details.planType} planPrices={planPrices} />
        {match(details.billing)
          .with({ type: 'nextBillingDate' }, ({ date }) => (
            <Row
              type="nextBillingDate"
              label={t('receipt.rows.nextBillingDate')}
              value={formatDate(date)}
            />
          ))
          .with({ type: 'renewalPending' }, () => <RenewalPendingRow />)
          .with({ type: 'subscriptionEndsOn' }, ({ date }) => (
            <Row
              type="subscriptionEndsOn"
              label={t('receipt.rows.subscriptionEndsOn')}
              value={formatDate(date)}
            />
          ))
          .exhaustive()}
        <AutoRenewalRow willRenew={details.willRenew} />
        {details.banked != null && (
          <BankedRewardRow banked={details.banked} formatDate={formatDate} />
        )}
      </VStack>
    ))
    .with({ variant: 'trial', details: P.nonNullable }, ({ details }) => (
      <VStack>
        <PlanRow planType={details.planType} planPrices={planPrices} />
        <Row
          type="trialEndsOn"
          label={t('receipt.rows.trialEndsOn')}
          value={formatDate(details.trialEndsOn)}
        />
        {match(details.billing)
          .with({ type: 'firstBillingDate' }, ({ date }) => (
            <FirstBillingDateRow
              date={date}
              price={planPrices[details.planType ?? TRIAL_FALLBACK_PLAN_TYPE]}
              formatDate={formatDate}
            />
          ))
          .with({ type: 'renewalPending' }, () => <RenewalPendingRow />)
          .with(null, () => null)
          .exhaustive()}
        <AutoRenewalRow willRenew={details.willRenew} />
        {details.banked != null && (
          <BankedRewardRow banked={details.banked} formatDate={formatDate} />
        )}
      </VStack>
    ))
    .with({ variant: 'reward', details: null }, () => <VStack />)
    .with({ variant: 'reward', details: P.nonNullable }, ({ details }) => (
      <VStack>
        <Row
          type="rewardPeriod"
          label={t('receipt.rows.rewardPeriod')}
          value={t('receipt.rows.until', { date: formatDate(details.periodEndsAt) })}
        />
        {details.chained != null && (
          <Row
            type="bankedReward"
            label={t('receipt.rows.bankedReward')}
            value={t('receipt.rows.days', { count: details.chained.bankedDays })}
          />
        )}
        {details.chained != null && (
          <Row
            type="overallPeriod"
            label={t('receipt.rows.overallPeriod')}
            value={t('receipt.rows.until', { date: formatDate(details.chained.overallEndsAt) })}
          />
        )}
        <Row
          type="daysLeft"
          label={t('receipt.rows.daysLeft')}
          value={match(details.daysLeft.endingNotice)
            .with('today', () => t('endingNotice.badgeToday'))
            .with('tomorrow', () => t('endingNotice.badgeTomorrow'))
            .with(null, () => t('receipt.rows.days', { count: details.daysLeft.days }))
            .exhaustive()}
          tone={details.daysLeft.endingNotice == null ? 'default' : 'brand'}
        />
      </VStack>
    ))
    .exhaustive();
}

/** 체험 뒤 첫 결제 금액에 쓸 요금제. 서버가 모르면 체험을 두는 연간이다(스토어 설정) */
const TRIAL_FALLBACK_PLAN_TYPE = 'annual' satisfies PlanType;

type ReceiptValueTone = 'default' | 'brand' | 'muted';

interface RowProps {
  /** 테스트와 기기 확인이 줄을 가리키는 이름 */
  type: string;
  label: string;
  value: string;
  tone?: ReceiptValueTone;
}

function Row({ type, label, value, tone = 'default' }: RowProps) {
  return (
    <ListRow
      verticalPadding="small"
      testID={`subscription-receipt-row-${type}`}
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

function PlanRow({
  planType,
  planPrices,
}: {
  planType: PlanType | null;
  planPrices: Record<PlanType, string | null>;
}) {
  const { t } = useTranslation('subscription');
  const price = planType == null ? null : planPrices[planType];
  const name = t(planType == null ? 'receipt.rows.planUnknown' : getPlanNameKey(planType));

  return (
    <Row
      type="plan"
      label={t('receipt.rows.plan')}
      value={price == null ? name : t('receipt.rows.planWithPrice', { plan: name, price })}
    />
  );
}

function RenewalPendingRow() {
  const { t } = useTranslation('subscription');

  return (
    <Row
      type="renewalPending"
      label={t('receipt.rows.nextBillingDate')}
      value={t('receipt.rows.renewalPending')}
      tone="muted"
    />
  );
}

function FirstBillingDateRow({
  date,
  price,
  formatDate,
}: {
  date: Instant;
  price: string | null;
  formatDate: (date: Instant) => string;
}) {
  const { t } = useTranslation('subscription');

  return (
    <Row
      type="firstBillingDate"
      label={t('receipt.rows.firstBillingDate')}
      value={
        price == null
          ? formatDate(date)
          : t('receipt.rows.dateWithPrice', { date: formatDate(date), price })
      }
    />
  );
}

function AutoRenewalRow({ willRenew }: { willRenew: boolean }) {
  const { t } = useTranslation('subscription');

  return (
    <Row
      type="autoRenewal"
      label={t('receipt.rows.subscriptionStatus')}
      value={willRenew ? t('receipt.rows.autoRenewalOn') : t('receipt.rows.autoRenewalOff')}
      tone={willRenew ? 'brand' : 'muted'}
    />
  );
}

function BankedRewardRow({
  banked,
  formatDate,
}: {
  banked: { days: number; endsAt: Instant | null };
  formatDate: (date: Instant) => string;
}) {
  const { t } = useTranslation('subscription');

  return (
    <Row
      type="bankedReward"
      label={t('receipt.rows.bankedReward')}
      value={
        banked.endsAt == null
          ? t('receipt.rows.days', { count: banked.days })
          : t('receipt.rows.daysUntil', { count: banked.days, date: formatDate(banked.endsAt) })
      }
    />
  );
}
