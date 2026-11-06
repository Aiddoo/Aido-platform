import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';

import { useMicrophonePermission } from './use-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  onSubscribe?: () => void;
  getRecordHref?: () => Href;
}

export function useVoiceNoteStart() {
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useMicrophonePermission();
  const [locale] = useRecognitionLanguage();
  const push = useSingleTap(router.push);

  return async ({ onSubscribe, getRecordHref }: StartVoiceNoteOptions = {}) => {
    if (!gate.guard({ onSubscribe })) {
      return;
    }
    const consent = await aiConsent.ensureAgreedBeforeListening();
    if (!consent.isAgreed) {
      return;
    }
    if (await ensureMicrophonePermission('note', locale)) {
      push(getRecordHref?.() ?? '/voice-notes/record');
    }
  };
}
