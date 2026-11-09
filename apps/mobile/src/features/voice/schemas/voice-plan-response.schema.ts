import {
  actionPlanSchema,
  quickPlanResponseSchema,
  voiceNoteDigestResponseSchema,
} from '@aido/api';
import { z } from 'zod';

// 새 서버의 모르는 행동 타입 하나로 계획 전체를 버리지 않게 느슨하게 받고 아는 타입만 toVoicePlan이 검증한다
const lenientActionPlanSchema = actionPlanSchema.extend({ actions: z.array(z.unknown()) });

export const lenientQuickPlanResponseSchema = quickPlanResponseSchema.extend({
  plan: lenientActionPlanSchema,
});

export const lenientVoiceNoteDigestResponseSchema = voiceNoteDigestResponseSchema.extend({
  plan: lenientActionPlanSchema,
});

export type LenientActionPlan = z.infer<typeof lenientActionPlanSchema>;
export type LenientQuickPlanResponse = z.infer<typeof lenientQuickPlanResponseSchema>;
export type LenientVoiceNoteDigestResponse = z.infer<typeof lenientVoiceNoteDigestResponseSchema>;
