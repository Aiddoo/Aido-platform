import {
  actionPlanSchema,
  quickPlanResponseSchema,
  voiceNoteDigestResponseSchema,
} from '@aido/api';
import { z } from 'zod';

/**
 * 새 서버가 더한 모르는 행동 타입 하나 때문에 계획 전체를 버리지 않도록 행동은 느슨하게 받고,
 * 아는 타입만 {@link toVoicePlan}이 계약대로 검증한다.
 */
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
