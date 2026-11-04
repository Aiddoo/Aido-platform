import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { voiceNoteDraftIdSchema } from '../domains/voice-note.model';

export const VOICE_NOTE_TABS = ['summary', 'todos', 'transcript'] as const;
export type VoiceNoteTab = (typeof VOICE_NOTE_TABS)[number];

export const voiceNoteTabSchema = z.enum(VOICE_NOTE_TABS);

export const voiceNoteParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  tab: voiceNoteTabSchema.catch('summary'),
});

export function useVoiceNoteParams() {
  return voiceNoteParamsSchema.parse(useLocalSearchParams());
}
