import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';

import { voiceNoteRecordHref } from '../utils/navigation/voice-note-href';
import { useMicrophonePermission } from './use-microphone-permission';
import { useRecognitionLanguage } from './use-recognition-language';

interface StartVoiceNoteOptions {
  /** 한도 안내에서 구독 화면으로 가기 직전에 부른다(열린 시트 닫기) */
  onSubscribe?: () => void;
  /** 확인을 모두 지난 뒤 녹음 화면으로 가기 직전에 부른다. 돌려준 주소로 간다(기본은 새 녹음) */
  getRecordHref?: () => ReturnType<typeof voiceNoteRecordHref>;
}

/** 말로 메모하기 진입. 한도 → AI 동의 → 마이크 권한을 지나면 녹음 화면으로 간다. 듣기는 그 화면이 시작한다 */
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
