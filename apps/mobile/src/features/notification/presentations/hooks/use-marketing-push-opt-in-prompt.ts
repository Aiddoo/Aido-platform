import type { SyncStorage } from '@src/core/ports/sync-storage';
import { useGetConsentQueryOptions } from '@src/features/auth/presentations/queries/use-get-consent-query-options';
import { useTrack } from '@src/shared/analytics';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  readMarketingPushPromptState,
  recordMarketingPushPrompt,
} from '@src/shared/preferences/marketing-push-prompt.preference';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MarketingPushPromptPolicy } from '../../models/marketing-push-prompt.policy';
import { useMarketingPushConsentSheet } from './use-marketing-push-consent-sheet';

interface MarketingPushOptInPrompt {
  /** 배너를 노출할지 여부 */
  visible: boolean;
  /** 동의 시트를 연다 (탭) */
  open: () => void;
  /** 배너를 닫고 쿨다운을 기록한다 (닫기 버튼) */
  dismiss: () => void;
}

/**
 * 마케팅 푸시 옵트인 배너의 표시 여부·상호작용을 소유하는 view-model 훅.
 *
 * 노출 판단은 순수 정책(MarketingPushPromptPolicy)에, 저장은 preference 포트에
 * 위임한다 — 표현(배너)과 행동을 분리한다(SRP). storage를 주입받아 테스트에서
 * 대체할 수 있다(DIP). 부수효과는 명시적 액션(open/dismiss)에서만 발생한다.
 */
export function useMarketingPushOptInPrompt(
  storage: SyncStorage = mmkvSyncStorage,
): MarketingPushOptInPrompt {
  const { trackEvent } = useTrack();
  const consentSheet = useMarketingPushConsentSheet();
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const [promptState] = useState(() => readMarketingPushPromptState(storage));
  const [dismissed, setDismissed] = useState(false);

  const visible = !dismissed && MarketingPushPromptPolicy.shouldPrompt(consent, promptState);

  const dismiss = () => {
    recordMarketingPushPrompt(storage, new Date());
    setDismissed(true);
    trackEvent('marketing_push_prompt_dismissed', { source: 'feed_banner' });
  };

  const open = () => {
    consentSheet.open({
      onAgree: () => trackEvent('marketing_push_opted_in', { source: 'feed_banner' }),
      onDismiss: dismiss,
    });
  };

  return { visible, open, dismiss };
}
