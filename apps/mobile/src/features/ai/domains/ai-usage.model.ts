import { aiUsageDataSchema } from '@aido/api';
import { z } from 'zod';

export const aiUsageSchema = aiUsageDataSchema.extend({ resetsAt: z.date() });
export type AiUsage = z.infer<typeof aiUsageSchema>;

export function isAiUsageLimitReached(usage: AiUsage): boolean {
  return usage.limit != null && usage.used >= usage.limit;
}

export function getAiUsageRemainingCount(usage: AiUsage): number | null {
  return usage.limit != null ? usage.limit - usage.used : null;
}

export const AiUsagePolicy = {
  isLimitReached: isAiUsageLimitReached,
  getRemainingCount: getAiUsageRemainingCount,
} as const;
