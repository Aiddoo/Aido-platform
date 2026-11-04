import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';

/** 오프라인에서 결제·복원 버튼을 잠근 이유 */
export function SubscriptionOfflineActionsNotice() {
  const { t } = useTranslation('subscription');

  return (
    <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
      {t('offline.actionsDisabled')}
    </Text>
  );
}
