import type {
  createNudgeSchema,
  createRemindNudgeSchema,
  replyToNudgeSchema,
  sendNudgeThanksSchema,
} from '@aido/api';
import type { z } from 'zod';

export type CreateNudgeInput = z.infer<typeof createNudgeSchema>;
export type CreateRemindNudgeInput = z.infer<typeof createRemindNudgeSchema>;
export type ReplyToNudgeInput = z.infer<typeof replyToNudgeSchema>;
export type SendNudgeThanksInput = z.infer<typeof sendNudgeThanksSchema>;
