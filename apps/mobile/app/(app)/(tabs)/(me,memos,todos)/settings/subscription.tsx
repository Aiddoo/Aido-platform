import { SubscriptionCheckout } from '@src/bootstrap/navigation/subscription-checkout';
import { useTranslation } from '@src/shared/i18n';
import { Stack } from 'expo-router';

export default function SubscriptionRoute() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.subscription') }} />
      <SubscriptionCheckout />
    </>
  );
}
