import { z } from 'zod';

import { voiceNoteDraftIdSchema } from '../domains/voice-note.model';

export const voiceNoteTabSchema = z.enum(['summary', 'todos', 'transcript']);

export type VoiceNoteTab = z.output<typeof voiceNoteTabSchema>;

export const voiceNoteParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  tab: voiceNoteTabSchema.catch('summary'),
});

export const voiceNoteRecordParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema.optional().catch(undefined),
  entry: z.enum(['memo_tab', 'quick_voice_upgrade']).catch('memo_tab'),
});
