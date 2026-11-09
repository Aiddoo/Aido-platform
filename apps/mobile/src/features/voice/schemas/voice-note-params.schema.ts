import { z } from 'zod';

import { voiceNoteDraftIdSchema } from '../domains/voice-note.model';

export const voiceNoteTabSchema = z.enum(['summary', 'todos', 'transcript']).catch('summary');

export type VoiceNoteTab = z.output<typeof voiceNoteTabSchema>;

export const voiceNoteParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
});

export const voiceNoteRecordParamsSchema = z.object({
  draftId: voiceNoteDraftIdSchema.optional().catch(undefined),
  entry: z.enum(['memo_tab', 'quick_voice_upgrade']).catch('memo_tab'),
});

/** 메모 탭에서 말로 메모하기를 바로 시작하라는 요청. 새 기능 소개처럼 권한 화면에서 넘어올 때 쓴다 */
export const voiceNoteStartParamsSchema = z.object({
  startVoiceNote: z.literal('1').optional().catch(undefined),
});
