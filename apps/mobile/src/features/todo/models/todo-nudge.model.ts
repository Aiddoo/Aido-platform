import { z } from 'zod';

export const nudgeLimitInfoSchema = z.object({
  dailyLimit: z.number().nullable(),
  usedToday: z.number(),
  remainingToday: z.number().nullable(),
  isUnlimited: z.boolean(),
});
export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

export const nudgeCooldownInfoSchema = z.object({
  canNudge: z.boolean(),
  cooldownEndsAt: z.date().nullable(),
  remainingSeconds: z.number().nullable(),
});
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

const MAX_MESSAGE_LENGTH = 200;

export const TodoNudgePolicy = {
  maxMessageLength: MAX_MESSAGE_LENGTH,

  normalizeMessage(message?: string | null): string | undefined {
    if (message == null) return undefined;
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },

  isMessageTooLong(message?: string | null): boolean {
    if (!message) return false;
    return message.trim().length > TodoNudgePolicy.maxMessageLength;
  },

  isLimitReached(limitInfo: NudgeLimitInfo): boolean {
    return limitInfo.remainingToday !== null && limitInfo.remainingToday <= 0;
  },
} as const;
