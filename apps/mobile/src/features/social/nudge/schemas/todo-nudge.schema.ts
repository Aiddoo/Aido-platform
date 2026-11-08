import {
  nudgeCooldownInfoSchema as nudgeCooldownInfoContractSchema,
  nudgeLimitInfoSchema as nudgeLimitInfoContractSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const nudgeLimitInfoSchema = nudgeLimitInfoContractSchema.pick({
  dailyLimit: true,
  usedToday: true,
  remainingToday: true,
  isUnlimited: true,
});
export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

/** 쿨다운 끝 시각은 응답 문자열 대신 Instant로 읽는다 */
const nudgeCooldownInfoSchema = nudgeCooldownInfoContractSchema
  .pick({ canNudge: true, remainingSeconds: true })
  .extend({ cooldownEndsAt: instantSchema.nullable() });
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

const sendTodoNudgeResultSchema = z.object({
  message: z.string(),
});
export type SendTodoNudgeResult = z.infer<typeof sendTodoNudgeResultSchema>;
