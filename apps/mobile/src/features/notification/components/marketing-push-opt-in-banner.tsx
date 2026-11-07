import { useMarketingPushPromptRepository } from '@src/bootstrap/providers/di-context';
import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/consent.queries';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, useOverlay } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { MarketingPushPromptPolicy } from '../domains/marketing-push-prompt.model';
import { PUSH_PERMISSION_STEP, PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';
import { MarketingPushConsentDialog } from './marketing-push-consent-dialog';

interface MarketingPushOptInBannerProps {
  className?: string;
}

/** 광고성 앱 푸시 미동의자에게 feed에서 동의를 다시 권한다. 노출과 상호작용은 아래 훅이 소유한다 */
export function MarketingPushOptInBanner({ className }: MarketingPushOptInBannerProps) {
  const { t } = useTranslation('notification');
  const { isVisible, open, dismiss } = useMarketingPushOptInPrompt();

  if (!isVisible) {
    return null;
  }

  return (
    <InlineAlert
      className={className}
      image={null}
      title={t('marketingOptIn.bannerTitle')}
      description={t('marketingOptIn.bannerDescription')}
      onPress={open}
      pressLabel={t('marketingOptIn.bannerTitle')}
      onClose={dismiss}
      closeLabel={t('marketingOptIn.bannerDismiss')}
    />
  );
}

interface MarketingPushOptInPrompt {
  isVisible: boolean;
  open: () => void;
  dismiss: () => void;
}

/**
 * 노출 판단은 MarketingPushPromptPolicy에, 저장은 MarketingPushPromptRepository에 맡긴다.
 * 부수효과는 명시적 액션(open/dismiss)에서만 일어난다.
 */
function useMarketingPushOptInPrompt(): MarketingPushOptInPrompt {
  const marketingPushPromptRepository = useMarketingPushPromptRepository();
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const [{ data: consent }, { data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [
      useGetConsentQueryOptions(),
      useGetPushPermissionQueryOptions(),
      useGetPreferenceQueryOptions(),
    ],
  });
  const [promptState] = useState(() => marketingPushPromptRepository.get());
  const [isDismissed, setIsDismissed] = useState(false);
  const now = useMinuteNow();

  // 기기 권한이나 앱 푸시 설정이 꺼져 있으면 알림 안내가 먼저다. 동의를 받아도 푸시가 닿지 않는다
  const isVisible =
    !isDismissed &&
    PushPermissionPolicy.getNextStep(permission, preference) === PUSH_PERMISSION_STEP.NONE &&
    MarketingPushPromptPolicy.shouldPrompt(consent, promptState, now);

  const dismiss = () => {
    marketingPushPromptRepository.record(getNowInstant());
    setIsDismissed(true);
    trackEvent('marketing_push_prompt_dismissed', { source: 'feed_banner' });
  };

  const open = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <MarketingPushConsentDialog
        isOpen={isOpen}
        onAgree={() => {
          trackEvent('marketing_push_opted_in', { source: 'feed_banner' });
          close();
          unmount();
        }}
        onDismiss={() => {
          dismiss();
          close();
          unmount();
        }}
      />
    ));
  };

  return { isVisible, open, dismiss };
}
