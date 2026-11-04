import { useMarketingPushPromptService } from '@src/bootstrap/providers/di-context';
import { useGetConsentQueryOptions } from '@src/features/auth/queries/get-consent-query-options';
import { useTrack } from '@src/shared/analytics';
import { useToday } from '@src/shared/hooks/use-today';
import { useSuspenseQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { MarketingPushPromptPolicy } from '../domains/marketing-push-prompt.model';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/get-push-permission-query-options';
import { useMarketingPushConsentSheet } from './use-marketing-push-consent-sheet';

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
  const consentSheet = useMarketingPushConsentSheet();
  const [{ data: consent }, { data: permission }] = useSuspenseQueries({
    queries: [useGetConsentQueryOptions(), useGetPushPermissionQueryOptions()],
  });
  const [promptState] = useState(() => marketingPushPromptService.getState());
  const [dismissed, setDismissed] = useState(false);
  const today = useToday();

  // 기기 알림이 꺼져 있으면 알림 권한 안내가 먼저다. 동의를 받아도 푸시가 닿지 않는다
  const isVisible =
    !dismissed &&
    PushPermissionPolicy.isDeliveryAllowed(permission) &&
    MarketingPushPromptPolicy.shouldPrompt(consent, promptState, today);

  const dismiss = () => {
    marketingPushPromptService.recordPrompt(new Date());
    setDismissed(true);
    trackEvent('marketing_push_prompt_dismissed', { source: 'feed_banner' });
  };

  const open = () => {
    consentSheet.open({
      onAgree: () => trackEvent('marketing_push_opted_in', { source: 'feed_banner' }),
      onDismiss: dismiss,
    });
  };

  return { isVisible, open, dismiss };
}
