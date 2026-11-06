import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import {
  voiceNoteParamsSchema,
  voiceNoteRecordParamsSchema,
  type VoiceNoteTab,
} from '../schemas/voice-note-params.schema';

export function useVoiceNoteRecordParams() {
  return voiceNoteRecordParamsSchema.parse(useLocalSearchParams());
}

export function useVoiceNoteParams() {
  return voiceNoteParamsSchema.parse(useLocalSearchParams());
}

export function useVoiceNoteTab() {
  const [{ tab }, setParams] = useRouteParams(voiceNoteParamsSchema);
  const setTab = useCallback((next: VoiceNoteTab) => setParams({ tab: next }), [setParams]);

  return [tab, setTab] as const;
}
