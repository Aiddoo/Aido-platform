import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { voiceNoteDraftIdSchema } from '../domains/voice-note.model';

export const VOICE_NOTE_TABS = ['summary', 'todos', 'transcript'] as const;
export type VoiceNoteTab = (typeof VOICE_NOTE_TABS)[number];

export const voiceNoteTabSchema = z.enum(VOICE_NOTE_TABS);

export const voiceNoteParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  tab: voiceNoteTabSchema.catch('summary'),
});

export const voiceNoteRecordParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema.optional().catch(undefined),
  entry: z.enum(['memo_tab', 'quick_voice_upgrade']).catch('memo_tab'),
});

export function useVoiceNoteRecordParams() {
  return voiceNoteRecordParamsSchema.parse(useLocalSearchParams());
}

export function useVoiceNoteParams() {
  return voiceNoteParamsSchema.parse(useLocalSearchParams());
}

export function useVoiceNoteTab() {
  const { tab } = useVoiceNoteParams();
  const setTab = useCallback((next: VoiceNoteTab) => router.setParams({ tab: next }), []);

  return [tab, setTab] as const;
}
