import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';

export function SubscriptionOfflineActionsNotice() {
  const { t } = useTranslation('subscription');

  return (
    <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
      {t('offline.actionsDisabled')}
    </Text>
  );
}
