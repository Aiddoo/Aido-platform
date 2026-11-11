import { useMyPageMenuNavigate } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  CrownDuoIcon,
  HStack,
  SettingsListGroup,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
  SurfaceCard,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';

import { EntitlementPolicy } from '../domains/entitlement.model';
import { useFormatReceiptDate } from '../hooks/use-format-receipt-date';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { toPlanSummary } from '../utils/plan-summary.view-model';
import { QuotaSummary } from './quota-summary';

const SUBSCRIPTION_PATHNAME = '/settings/subscription';

export function PlanSummary() {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const navigate = useMyPageMenuNavigate();

  return match(EntitlementPolicy.hasFullAccess(entitlements))
    .with(false, () => (
      <QuotaSummary
        action={
          <TextButton
            size="small"
            variant="arrow"
            onPress={() => navigate(SUBSCRIPTION_PATHNAME)}
            testID="plan-summary-see-premium"
          >
            {t('upsell.viewPremium')}
          </TextButton>
        }
      />
    ))
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
        <HStack gap={12} align="center">
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

PlanSummary.Loading = function Loading() {
  return (
    <SurfaceCard className="gap-3" accessibilityState={{ busy: true }}>
      <TextSkeleton size="b4" className="w-32" />
      <TextSkeleton size="b3" className="w-full" />
      <TextSkeleton size="b3" className="w-3/4" />
    </SurfaceCard>
  );
};

PlanSummary.Error = SettingsListGroup.Error;
