import catAnchorImage from '@assets/images/cat_weather_anchor.png';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorActions, ReadableContent, Result, StyledSafeAreaView } from '@src/shared/ui';
import { type ComponentProps, useEffect } from 'react';
import { AccessibilityInfo, Image } from 'react-native';

import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import type { SubscriptionSupportFailure } from '../utils/view-models/subscription-failure.view-model';

interface SubscriptionResultProps extends Omit<
  ComponentProps<typeof Result>,
  'icon' | 'className'
> {
  /** 화면이 실패 안내로 바뀌면 스크린 리더에도 알린다 */
  isAlert?: boolean;
}

/** 구독 화면의 오프라인·실패 안내. 같은 고양이 그림과 자리로 상태만 바꿔 보여 준다 */
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
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ReadableContent className="flex-1 px-6" accessibilityRole={isAlert ? 'alert' : undefined}>
        <Result
          icon={
            <Image
              source={catAnchorImage}
              accessibilityIgnoresInvertColors
              className="size-[120px]"
              resizeMode="contain"
            />
          }
          title={title}
          description={description}
          {...props}
        />
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

interface SubscriptionOfflineResultProps {
  target: 'receipt' | 'plans';
}

/** 오프라인은 실패가 아니라 기다리면 풀리는 상태라 다시 시도·문의 대신 자동으로 이어진다고 알린다 */
SubscriptionResult.Offline = function Offline({ target }: SubscriptionOfflineResultProps) {
  const { t } = useTranslation('subscription');

  return (
    <SubscriptionResult
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

/** 구독 실패 안내. 무엇이 실패했는지 → 할 일 → 다시 시도 → 문의하기 순서를 모든 실패에서 지킨다 */
SubscriptionResult.Failure = function Failure({
  failure,
  onRetry,
}: SubscriptionFailureResultProps) {
  const { t } = useTranslation(['subscription']);
  const openInquiry = useOpenSubscriptionInquiry();

  return (
    <SubscriptionResult
      isAlert
      title={t(failure.titleKey)}
      description={t(failure.descriptionKey)}
      testID="subscription-load-failure"
      button={<QueryErrorActions onRetry={onRetry} onInquiry={() => openInquiry(failure)} />}
    />
  );
};
