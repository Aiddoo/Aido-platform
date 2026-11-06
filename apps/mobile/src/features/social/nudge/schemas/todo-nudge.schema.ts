import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const nudgeLimitInfoSchema = z.object({
  dailyLimit: z.number().nullable(),
  usedToday: z.number(),
  remainingToday: z.number().nullable(),
  isUnlimited: z.boolean(),
});
export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

const nudgeCooldownInfoSchema = z.object({
  canNudge: z.boolean(),
  cooldownEndsAt: instantSchema.nullable(),
  remainingSeconds: z.number().nullable(),
});
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

const sendTodoNudgeResultSchema = z.object({
  message: z.string(),
});
export type SendTodoNudgeResult = z.infer<typeof sendTodoNudgeResultSchema>;
