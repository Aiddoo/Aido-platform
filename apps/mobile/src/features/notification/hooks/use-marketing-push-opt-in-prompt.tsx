import { useMarketingPushPromptService } from '@src/bootstrap/providers/di-context';
import { useGetConsentQueryOptions } from '@src/features/identity/auth/queries/get-consent-query-options';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/get-preference-query-options';
import { useTrack } from '@src/shared/analytics';
import { useToday } from '@src/shared/hooks/use-today';
import { useOverlay } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { MarketingPushConsentDialog } from '../components/marketing-push-consent-dialog';
import { MarketingPushPromptPolicy } from '../domains/marketing-push-prompt.model';
import { PUSH_PERMISSION_STEP, PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/get-push-permission-query-options';

interface MarketingPushOptInPrompt {
  /** 배너를 노출할지 여부 */
  isVisible: boolean;
  /** 동의 시트를 연다 (탭) */
  open: () => void;
  /** 배너를 닫고 쿨다운을 기록한다 (닫기 버튼) */
  dismiss: () => void;
}

/**
 * 마케팅 푸시 옵트인 배너의 표시 여부·상호작용을 소유하는 view-model 훅.
 *
 * 노출 판단은 MarketingPushPromptPolicy에, 저장은 MarketingPushPromptService에 맡긴다.
 * 부수효과는 명시적 액션(open/dismiss)에서만 일어난다.
 */
export function useMarketingPushOptInPrompt(): MarketingPushOptInPrompt {
  const marketingPushPromptService = useMarketingPushPromptService();
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const [{ data: consent }, { data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [
      useGetConsentQueryOptions(),
      useGetPushPermissionQueryOptions(),
      useGetPreferenceQueryOptions(),
    ],
  });
  const [promptState] = useState(() => marketingPushPromptService.getState());
  const [dismissed, setDismissed] = useState(false);
  const today = useToday();

  // 기기 권한이나 앱 푸시 설정이 꺼져 있으면 알림 안내가 먼저다. 동의를 받아도 푸시가 닿지 않는다
  const isVisible =
    !dismissed &&
    PushPermissionPolicy.nextStep(permission, preference) === PUSH_PERMISSION_STEP.NONE &&
    MarketingPushPromptPolicy.shouldPrompt(consent, promptState, today);

  const dismiss = () => {
    marketingPushPromptService.recordPrompt(new Date());
    setDismissed(true);
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
