import { SubscriptionCheckout } from '@src/bootstrap/navigation/subscription-checkout';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function SubscriptionScreen() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.subscription') }} />
      <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <QueryErrorBoundary fallback={SubscriptionCheckout.Error}>
          <Suspense fallback={<SubscriptionCheckout.Loading />}>
            <SubscriptionCheckout />
          </Suspense>
        </QueryErrorBoundary>
      </StyledSafeAreaView>
    </>
  );
}
