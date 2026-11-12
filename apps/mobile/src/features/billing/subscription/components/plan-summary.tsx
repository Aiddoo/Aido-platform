import type { PlanQuotaFeatureKey } from '@aido/api/vocabulary';
import { useMyPageMenuNavigate } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  ArrowRightIcon,
  Box,
  CrownDuoIcon,
  HStack,
  SettingsListGroup,
  Meter,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
  SurfaceCard,
  WordWrapText,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { EntitlementPolicy } from '../domains/entitlement.model';
import { useFormatReceiptDate } from '../hooks/use-format-receipt-date';
import { useFormatRefillSentence } from '../hooks/use-format-refill-sentence';
import { useQuotaStatus } from '../hooks/use-quota-status';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { toDisplayedUsedCount, toPlanSummary } from '../utils/plan-summary.view-model';

const SUBSCRIPTION_PATHNAME = '/settings/subscription';

interface QuotaProps {
  action?: ReactNode;
}

export function PlanSummary() {
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());

  return match(EntitlementPolicy.hasFullAccess(entitlements))
    .with(false, () => <PlanSummary.Quota action={<ViewPremiumButton />} />)
    .with(true, () => <PlanSummary.Premium />)
    .exhaustive();
}

PlanSummary.Premium = function Premium() {
  const { t } = useTranslation('subscription');
  const navigate = useMyPageMenuNavigate();
  const { headline, dateLabel, period, note } = toPlanSummary(useSubscriptionReceipt());
  const formatDate = useFormatReceiptDate(dateLabel);

  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={() => navigate(SUBSCRIPTION_PATHNAME)}
      className="rounded-2xl bg-gray-1 p-4"
      testID="plan-summary-premium"
    >
      <VStack gap={12}>
        <HStack className="gap-3" align="center">
          <SettingsListGroup.Icon Icon={CrownDuoIcon} />

          <VStack flex={1} gap={2}>
            <Text size="b2" weight="bold" shade={9} lineBreakStrategyIOS="hangul-word">
              {match(headline)
                .with({ type: 'subscription', planType: 'annual' }, () => t('planSummary.annual'))
                .with({ type: 'subscription', planType: 'monthly' }, () => t('planSummary.monthly'))
                .with({ type: 'subscription', planType: null }, () => t('planSummary.unknown'))
                .with({ type: 'trial' }, () => t('receipt.trial.title'))
                .with({ type: 'reward' }, () => t('receipt.reward.title'))
                .with({ type: 'admin' }, () => t('receipt.admin.title'))
                .exhaustive()}
            </Text>

            {period != null && (
              <Text size="b4" shade={7} lineBreakStrategyIOS="hangul-word">
                {match(period)
                  .with({ type: 'renewalPending' }, () => t('receipt.rows.renewalPending'))
                  .with({ type: 'nextBilling' }, ({ date }) =>
                    t('planSummary.nextBilling', { date: formatDate(date) }),
                  )
                  .with({ type: 'firstBilling' }, ({ date }) =>
                    t('planSummary.firstBilling', { date: formatDate(date) }),
                  )
                  .with({ type: 'endsOn' }, ({ date }) =>
                    t('planSummary.endsOn', { date: formatDate(date) }),
                  )
                  .exhaustive()}
              </Text>
            )}
          </VStack>

          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>

        {note != null && (
          <Text
            size="b4"
            shade={8}
            lineBreakStrategyIOS="hangul-word"
            className="rounded-xl bg-white px-3 py-2.5 dark:bg-gray-2"
          >
            {match(note)
              .with({ type: 'rewardStartsAfterSubscription' }, ({ days }) =>
                t('receipt.footnote.rewardStartsAfterSubscription', { count: days }),
              )
              .with({ type: 'rewardStartsOn' }, ({ days, date }) =>
                t('receipt.footnote.rewardStartsOn', { count: days, date: formatDate(date) }),
              )
              .exhaustive()}
          </Text>
        )}
      </VStack>
    </PressableFeedback>
  );
};

PlanSummary.Quota = function Quota({ action }: QuotaProps) {
  const { t } = useTranslation('subscription');
  const aiParse = useQuotaStatus('AI_PARSE');
  const voiceNote = useQuotaStatus('VOICE_NOTE');

  if (aiParse.label == null && voiceNote.label == null) {
    return null;
  }

  return (
    <SurfaceCard className="gap-4" testID="quota-summary">
      <QuotaHeader action={action} />
      <QuotaRow feature="AI_PARSE" label={t('quota.aiParse')} hint={t('quota.aiParseHint')} />
      <QuotaRow feature="VOICE_NOTE" label={t('quota.voiceNote')} />
    </SurfaceCard>
  );
};

/** 받은 뒤와 같은 카드로 자리를 잡는다. 영속 권한 캐시로 프리미엄을 알면 그 모양, 모르면 대부분인 무료 모양이다 */
PlanSummary.Loading = function Loading() {
  const { data: entitlements } = useQuery(useGetEntitlementsQueryOptions());

  if (entitlements != null && EntitlementPolicy.hasFullAccess(entitlements)) {
    return <PremiumSkeleton />;
  }
  return <QuotaSkeleton />;
};

PlanSummary.Error = SettingsListGroup.Error;

function ViewPremiumButton() {
  const { t } = useTranslation('subscription');
  const navigate = useMyPageMenuNavigate();

  return (
    <TextButton
      size="small"
      variant="arrow"
      onPress={() => navigate(SUBSCRIPTION_PATHNAME)}
      testID="plan-summary-see-premium"
    >
      {t('upsell.viewPremium')}
    </TextButton>
  );
}

function PremiumSkeleton() {
  return (
    <Box className="rounded-2xl bg-gray-1 p-4" accessibilityState={{ busy: true }}>
      <HStack className="gap-3" align="center">
        <SettingsListGroup.Icon Icon={CrownDuoIcon} />
        <VStack flex={1} gap={2}>
          <TextSkeleton size="b2" className="w-28" />
          <TextSkeleton size="b4" className="w-40" />
        </VStack>
        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
    </Box>
  );
}

function QuotaSkeleton() {
  const { t } = useTranslation('subscription');

  return (
    <SurfaceCard className="gap-4" accessibilityState={{ busy: true }}>
      <QuotaHeader action={<ViewPremiumButton />} />
      <QuotaRowLayout
        label={t('quota.aiParse')}
        hint={t('quota.aiParseHint')}
        usage={<TextSkeleton size="b4" className="w-12" />}
        meter={{ used: 0, limit: 1 }}
        refill={null}
      />
      <QuotaRowLayout
        label={t('quota.voiceNote')}
        usage={<TextSkeleton size="b4" className="w-12" />}
        meter={{ used: 0, limit: 1 }}
        refill={null}
      />
    </SurfaceCard>
  );
}

function QuotaHeader({ action }: QuotaProps) {
  const { t } = useTranslation('subscription');

  return (
    <HStack gap={6} align="center">
      <AiFilledIcon width={16} height={16} colorClassName="text-main" />
      <Text size="b4" weight="semibold" shade={7} className="flex-1">
        {t('quota.summaryTitle')}
      </Text>
      {action}
    </HStack>
  );
}

interface QuotaRowProps {
  feature: PlanQuotaFeatureKey;
  label: string;
  hint?: string;
}

/** 막대는 쓴 만큼 찬다. 다 쓴 항목만 주황으로 칠하고 다시 생기는 날을 붙인다 */
function QuotaRow({ feature, label, hint }: QuotaRowProps) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const { type } = useQuotaStatus(feature);
  const formatRefillSentence = useFormatRefillSentence();

  if (snapshot == null || type === 'untracked') {
    return null;
  }
  const used = EntitlementPolicy.getUsedCount(snapshot, feature);
  const limit = EntitlementPolicy.getLimit(snapshot, feature);
  if (used == null || limit == null) {
    return null;
  }

  const isUsedUp = type === 'used-up';

  return (
    <QuotaRowLayout
      label={label}
      hint={hint}
      usage={
        <Text
          size="b4"
          weight="semibold"
          tone={isUsedUp ? 'brand' : undefined}
          shade={isUsedUp ? undefined : 7}
          className="tabular-nums"
        >
          {t('upsell.usage', {
            used: formatCount(toDisplayedUsedCount(used, limit), locale),
            limit: formatCount(limit, locale),
          })}
        </Text>
      }
      meter={{ used, limit }}
      refill={isUsedUp ? formatRefillSentence(snapshot, feature) : null}
    />
  );
}

interface QuotaRowLayoutProps {
  label: string;
  hint?: string;
  usage: ReactNode;
  meter: { used: number; limit: number };
  refill: string | null;
}

function QuotaRowLayout({ label, hint, usage, meter, refill }: QuotaRowLayoutProps) {
  return (
    <VStack gap={6}>
      <HStack gap={12} align="center">
        <Text size="b3" weight="medium" className="flex-1">
          {label}
        </Text>
        {usage}
      </HStack>
      <Meter
        value={meter.used}
        max={meter.limit}
        size="medium"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {refill != null && (
        <Text size="e1" weight="semibold" shade={7}>
          {refill}
        </Text>
      )}
      {hint != null && (
        <WordWrapText size="e1" shade={6}>
          {hint}
        </WordWrapText>
      )}
    </VStack>
  );
}
