import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Button, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { useOpenSubscriptionManagement } from '../hooks/use-open-subscription-management';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import type { SubscriptionView } from '../schemas/subscription-params.schema';
import { PremiumNotice } from './premium-notice';
import { RestorePurchaseButton } from './restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';
import { SubscriptionReceipt } from './subscription-receipt';

interface SubscriberPaneProps {
  /** 보상 기간 영수증에 찍는 도장 */
  rewardStamp?: ReactNode;
}

export function SubscriberPane({ rewardStamp }: SubscriberPaneProps) {
  const { t } = useTranslation('subscription');
  const { primaryAction } = useSubscriptionReceipt();
  const openSubscriptionManagement = useOpenSubscriptionManagement();
  const isOnline = useIsOnline();

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <PremiumNotice.Ending />

        <SubscriptionReceipt rewardStamp={rewardStamp} />

        <Spacing size={16} />

        {match(primaryAction)
          .with('subscribe', () => (
            <Button
              onPress={() =>
                router.push({
                  pathname: '/settings/subscription',
                  params: { view: 'plans' satisfies SubscriptionView },
                })
              }
            >
              {t('subscriber.subscribeAfterGrantButton')}
            </Button>
          ))
          .with('manage', () => (
            <Button onPress={openSubscriptionManagement} variant="weak" color="dark">
              {t('subscriber.manageButton')}
            </Button>
          ))
          .with(null, () => null)
          .exhaustive()}

        <Spacing size={16} />

        <VStack gap={8} className="items-center">
          <RestorePurchaseButton size="medium" />
          {!isOnline && <SubscriptionOfflineActionsNotice />}
        </VStack>
      </StyledSafeAreaView>
    </ScrollView>
  );
}
