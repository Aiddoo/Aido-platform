import { z } from 'zod';

import type { QuickPlanResult } from './voice-plan.model';

export const voiceNoteKeyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  // 말한 시각을 찾지 못하면 null이라 그 지점으로 갈 수 없다
  startMs: z.int().nonnegative().nullable(),
  isBookmarked: z.boolean(),
});
export type VoiceNoteKeyPoint = z.infer<typeof voiceNoteKeyPointSchema>;

export const voiceNoteDigestSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(voiceNoteKeyPointSchema),
});

export interface VoiceNoteDigestResult extends QuickPlanResult {
  title: string;
  summary: string;
  keyPoints: { text: string; startMs: number | null }[];
}
