import { useTranslation } from '@src/shared/i18n';
import { Result, TextButton, VStack } from '@src/shared/ui';

import type { StoreUnavailable } from '../domains/subscription-failure.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toSubscriptionStoreUnavailableFailure } from '../utils/view-models/subscription-failure.view-model';
import { SubscriptionResult } from './subscription-result';

interface SubscriptionStoreUnavailableProps {
  unavailable: StoreUnavailable;
  /** 잠깐의 스토어 문제일 때만 보인다. 설정 문제는 다시 해도 같다 */
  onRetry: () => void;
  isRetrying?: boolean;
}

/** 스토어를 쓸 수 없어 요금제를 보여 줄 수 없을 때. 다시 해도 풀리지 않는 일이 많아 문의를 먼저 둔다 */
export function SubscriptionStoreUnavailable({
  unavailable,
  onRetry,
  isRetrying = false,
}: SubscriptionStoreUnavailableProps) {
  const { t } = useTranslation(['subscription', 'common']);
  const openInquiry = useOpenSubscriptionInquiry();
  const failure = toSubscriptionStoreUnavailableFailure(unavailable);

  return (
    <SubscriptionResult
      isAlert
      title={t(failure.titleKey)}
      description={t(failure.descriptionKey)}
      testID="subscription-store-unavailable"
      button={
        <VStack align="center" gap={8}>
          <Result.Button onPress={() => openInquiry(failure)}>
            {t('subscription:failure.contactSupport')}
          </Result.Button>
          {failure.canRetry && (
            <TextButton size="small" onPress={onRetry} isDisabled={isRetrying}>
              {t('common:actions.retry')}
            </TextButton>
          )}
        </VStack>
      }
    />
  );
}
