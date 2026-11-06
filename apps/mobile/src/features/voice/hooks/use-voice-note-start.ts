import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';

import { useMicrophonePermission } from './use-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  onSubscribe?: () => void;
  getRecordHref?: () => Href;
  /** 녹음 화면으로 넘어가는 방법. 기본은 지금 화면 위에 쌓는다 */
  navigate?: (href: Href) => void;
}

export function useVoiceNoteStart() {
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useMicrophonePermission();
  const [locale] = useRecognitionLanguage();
  const push = useSingleTap(router.push);

  return async ({ onSubscribe, getRecordHref, navigate = push }: StartVoiceNoteOptions = {}) => {
    if (!gate.guard({ onSubscribe })) {
      return;
    }
    const consent = await aiConsent.ensureAgreedBeforeListening();
    if (!consent.isAgreed) {
      return;
    }
    if (await ensureMicrophonePermission('note', locale)) {
      navigate(getRecordHref?.() ?? '/voice-notes/record');
    }
  };
}
