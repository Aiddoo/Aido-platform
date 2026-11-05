import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Button, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { useOpenSubscriptionManagement } from '../hooks/use-open-subscription-management';
import { useSubscriptionReceipt } from '../hooks/use-subscription-receipt';
import { subscriptionHref } from '../utils/navigation/subscription-href';
import { PremiumNotice } from './premium-notice';
import { RestorePurchaseButton } from './restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';
import { SubscriptionReceipt } from './subscription-receipt';

export function SubscriberPane() {
  const { t } = useTranslation('subscription');
  const { primaryAction } = useSubscriptionReceipt();
  const openSubscriptionManagement = useOpenSubscriptionManagement();
  const isOnline = useIsOnline();

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <PremiumNotice.Ending />

        <SubscriptionReceipt />

        <Spacing size={16} />

        {match(primaryAction)
          .with('subscribe', () => (
            <Button onPress={() => router.push(subscriptionHref({ view: 'plans' }))}>
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
