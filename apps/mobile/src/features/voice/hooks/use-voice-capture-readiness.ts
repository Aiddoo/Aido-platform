import type { SpeechLocale, SpeechMode } from '@src/core/ports/speech-recognizer';
import type { EntitlementGateSurface } from '@src/features/billing/subscription/constants/subscription.events';
import type { EntitlementFeature } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useClaimAiConsentRenewal } from '@src/features/device/coachmark/hooks/use-claim-ai-consent-renewal';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';

interface UseVoiceCaptureReadinessOptions {
  feature: Extract<EntitlementFeature, 'AI_PARSE' | 'VOICE_NOTE'>;
  surface: EntitlementGateSurface;
  mode: Extract<SpeechMode, 'quick' | 'note'>;
}

interface EnsureVoiceCaptureReadyOptions {
  locale: SpeechLocale;
  /** 시작을 누른 곳. 막혀도 누른 것으로 센다 */
  entry: VoiceCaptureEntry;
  /** 한도 안내에서 구독 화면으로 갈 때. 시트는 닫고 떠난다 */
  onSubscribe?: () => void;
}

export type VoiceCaptureReadiness =
  | { isReady: false }
  | {
      isReady: true;
      /** 듣기 전에 AI 동의를 물었다. 같은 시도에서 서버가 동의를 다시 요구해도 또 묻지 않는다 */
      wasConsentAsked: boolean;
    };

const NOT_READY: VoiceCaptureReadiness = { isReady: false };

/** 한도 → AI 동의 → 마이크 권한 순서로 묻는다. 답을 기다리는 사이 화면이 내려가면 듣지 않는다 */
export function useVoiceCaptureReadiness({
  feature,
  surface,
  mode,
}: UseVoiceCaptureReadinessOptions) {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const gate = useEntitlementGate(feature, { surface });
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const aiConsent = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const ensureMicrophonePermission = useEnsureMicrophonePermission();
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return async ({
    locale,
    entry,
    onSubscribe,
  }: EnsureVoiceCaptureReadyOptions): Promise<VoiceCaptureReadiness> => {
    trackEvent('voice_capture_start_tapped', { mode, entry });
    if (gate.promptIfBlocked({ onSubscribe })) {
      return NOT_READY;
    }
    // 동의 시트와 권한 창이 키보드에 가리지 않게 내린다
    Keyboard.dismiss();
    const consent = await aiConsent.requestAgreementBeforeListening();
    if (!consent.hasAgreed) {
      toast.toast(t('consent.notice.voice'));
      return NOT_READY;
    }
    if (isUnmountedRef.current) {
      return NOT_READY;
    }
    const isGranted = await ensureMicrophonePermission(mode, locale);
    if (!isGranted || isUnmountedRef.current) {
      return NOT_READY;
    }
    return { isReady: true, wasConsentAsked: consent.wasAsked };
  };
}
