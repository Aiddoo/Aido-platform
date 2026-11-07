import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { type Href, router } from 'expo-router';

import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  onSubscribe?: () => void;
  prepareRecordHref?: () => Href;
  /** 녹음 화면으로 넘어가는 방법. 기본은 지금 화면 위에 쌓는다 */
  navigate?: (href: Href) => void;
}

export function useStartVoiceNote() {
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useEnsureMicrophonePermission();
  const [locale] = useRecognitionLanguage();
  const push = useSingleTap(router.push);
  const toast = useAppToast();

  return async ({
    onSubscribe,
    prepareRecordHref,
    navigate = push,
  }: StartVoiceNoteOptions = {}) => {
    if (gate.promptIfBlocked({ onSubscribe })) {
      return;
    }
    const consent = await aiConsent.ensureAgreedBeforeListening();
    if (!consent.hasAgreed) {
      toast.toast(t('ai:consent.notice.voice'));
      return;
    }
    if (!(await ensureMicrophonePermission('note', locale))) {
      return;
    }
    navigate(prepareRecordHref?.() ?? '/voice-notes/record');
  };
}
