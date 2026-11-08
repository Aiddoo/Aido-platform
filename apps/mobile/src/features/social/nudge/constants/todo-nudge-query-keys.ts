import type { NudgeDirection } from '../schemas/nudge-interaction-query-key.schema';

export const TODO_NUDGE_QUERY_KEYS = {
  all: ['nudge'] as const,
  interactions: () => [...TODO_NUDGE_QUERY_KEYS.all, 'interaction'] as const,
  interactionAvailability: () => [...TODO_NUDGE_QUERY_KEYS.interactions(), 'availability'] as const,
  interactionList: ({ direction }: { direction: NudgeDirection }) =>
    [...TODO_NUDGE_QUERY_KEYS.interactions(), 'list', { direction }] as const,
  interaction: ({ nudgeId }: { nudgeId: number }) =>
    [...TODO_NUDGE_QUERY_KEYS.interactions(), 'detail', { nudgeId }] as const,
  thanksPreview: ({ todoId }: { todoId: number }) =>
    [...TODO_NUDGE_QUERY_KEYS.interactions(), 'thanks', { todoId }] as const,
  limit: () => [...TODO_NUDGE_QUERY_KEYS.all, 'limit'] as const,
  remindCooldown: ({ userId }: { userId: string }) =>
    [...TODO_NUDGE_QUERY_KEYS.all, 'remind-cooldown', { userId }] as const,
} as const;
