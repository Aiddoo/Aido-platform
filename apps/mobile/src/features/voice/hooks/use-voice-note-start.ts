import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';

import { voiceNoteRecordHref } from '../utils/navigation/voice-note-href';
import { useMicrophonePermission } from './use-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  onSubscribe?: () => void;
  getRecordHref?: () => ReturnType<typeof voiceNoteRecordHref>;
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
      push(getRecordHref?.() ?? voiceNoteRecordHref());
    }
  };
}
