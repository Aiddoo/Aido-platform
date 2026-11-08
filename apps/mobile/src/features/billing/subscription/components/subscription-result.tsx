import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ErrorIllustration,
  OfflineIllustration,
  QueryErrorActions,
  Result,
} from '@src/shared/ui';
import { type ComponentProps, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import type { SubscriptionSupportFailure } from '../utils/subscription-failure.view-model';

interface SubscriptionResultProps extends ComponentProps<typeof Result> {
  isAlert?: boolean;
}

export function SubscriptionResult({
  isAlert = false,
  title,
  description,
  ...props
}: SubscriptionResultProps) {
  useEffect(() => {
    if (!isAlert) {
      return;
    }
    AccessibilityInfo.announceForAccessibilityWithOptions(
      description == null ? title : `${title}. ${description}`,
      { queue: true },
    );
  }, [isAlert, title, description]);

  return (
    <Box flex={1} accessibilityRole={isAlert ? 'alert' : undefined}>
      <Result title={title} description={description} {...props} />
    </Box>
  );
}

interface SubscriptionOfflineResultProps {
  target: 'receipt' | 'plans';
}

// 오프라인은 실패가 아니라 기다리면 풀리는 상태다
SubscriptionResult.Offline = function Offline({ target }: SubscriptionOfflineResultProps) {
  const { t } = useTranslation('subscription');

  return (
    <SubscriptionResult
      icon={<OfflineIllustration />}
      title={t(target === 'receipt' ? 'offline.receiptTitle' : 'offline.plansTitle')}
      description={t('offline.description')}
      testID="subscription-offline"
    />
  );
};

interface SubscriptionFailureResultProps {
  failure: SubscriptionSupportFailure;
  onRetry: () => void;
}

SubscriptionResult.Failure = function Failure({
  failure,
  onRetry,
}: SubscriptionFailureResultProps) {
  const { t } = useTranslation(['subscription']);
  const openInquiry = useOpenSubscriptionInquiry();

  return (
    <SubscriptionResult
      isAlert
      icon={<ErrorIllustration />}
      title={t(failure.titleKey)}
      description={t(failure.descriptionKey)}
      testID="subscription-load-failure"
      button={<QueryErrorActions onRetry={onRetry} onInquiry={() => openInquiry(failure)} />}
    />
  );
};
