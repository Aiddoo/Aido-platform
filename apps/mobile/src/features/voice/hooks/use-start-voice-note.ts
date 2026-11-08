import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useClaimAiConsentRenewal } from '@src/features/device/coachmark/hooks/use-claim-ai-consent-renewal';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { router } from 'expo-router';

import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  onSubscribe?: () => void;
  /** 한도·동의·마이크 권한을 모두 통과했다. 기본은 녹음 화면을 지금 화면 위에 쌓는다 */
  onReadyToRecord?: () => void;
}

export function useStartVoiceNote() {
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const aiConsent = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const ensureMicrophonePermission = useEnsureMicrophonePermission();
  const [locale] = useRecognitionLanguage();
  const push = useSingleTap(router.push);
  const toast = useAppToast();

  return async ({
    onSubscribe,
    onReadyToRecord = () => push('/voice-notes/record'),
  }: StartVoiceNoteOptions = {}) => {
    if (gate.promptIfBlocked({ onSubscribe })) {
      return;
    }
    const consent = await aiConsent.requestAgreementBeforeListening();
    if (!consent.hasAgreed) {
      toast.toast(t('ai:consent.notice.voice'));
      return;
    }
    if (!(await ensureMicrophonePermission('note', locale))) {
      return;
    }
    onReadyToRecord();
  };
}
