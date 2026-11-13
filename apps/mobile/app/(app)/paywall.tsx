import { SubscriptionCheckout } from '@src/bootstrap/navigation/subscription-checkout';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { STACK_CLOSE_ICON } from '@src/shared/ui';
import { Stack } from 'expo-router';

/** 업셀에서 연 결제 흐름. 닫으면 연 화면(탭·스크롤)이 그대로다 */
export default function PaywallRoute() {
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
      <SubscriptionCheckout />
    </>
  );
}
