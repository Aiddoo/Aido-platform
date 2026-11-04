import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { VOICE_NOTE_RECORD_HREF } from '../utils/navigation/voice-note-href';
import { useMicrophonePermission } from './use-microphone-permission';

/** 말로 메모하기 진입. 한도 → AI 동의 → 마이크 권한을 지나면 녹음 화면으로 간다. 듣기는 그 화면이 시작한다 */
export function useVoiceNoteStart() {
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useMicrophonePermission();
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });
  const push = useSingleTap(router.push);

  return async () => {
    if (!gate.guard()) {
      return;
    }
    if (me != null) {
      await aiConsent.ensureAgreedOnce(me.id);
    }
    if (await ensureMicrophonePermission('note')) {
      push(VOICE_NOTE_RECORD_HREF);
    }
  };
}
