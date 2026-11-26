import { SubscriptionCheckout } from '@src/bootstrap/navigation/subscription-checkout';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, STACK_CLOSE_ICON, StyledSafeAreaView } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

/** 업셀에서 연 결제 흐름. 닫으면 연 화면(탭·스크롤)이 그대로다 */
export default function PaywallScreen() {
  const { t } = useTranslation('common');
  const close = useGoBack({ fallbackHref: '/feed' });

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={STACK_CLOSE_ICON}
          accessibilityLabel={t('actions.close')}
          onPress={close}
        />
      </Stack.Toolbar>
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
