import type { NudgeDirection } from '../domains/nudge-interaction.model';

export const NUDGE_QUERY_KEYS = {
  all: ['nudge'] as const,
  interactions: () => [...NUDGE_QUERY_KEYS.all, 'interaction'] as const,
  interactionAvailability: () => [...NUDGE_QUERY_KEYS.interactions(), 'availability'] as const,
  interactionList: ({ direction }: { direction: NudgeDirection }) =>
    [...NUDGE_QUERY_KEYS.interactions(), 'list', { direction }] as const,
  interaction: ({ nudgeId }: { nudgeId: number }) =>
    [...NUDGE_QUERY_KEYS.interactions(), 'detail', { nudgeId }] as const,
  thanksPreview: ({ todoId }: { todoId: number }) =>
    [...NUDGE_QUERY_KEYS.interactions(), 'thanks', { todoId }] as const,
  limit: () => [...NUDGE_QUERY_KEYS.all, 'limit'] as const,
  remindCooldown: ({ userId }: { userId: string }) =>
    [...NUDGE_QUERY_KEYS.all, 'remind-cooldown', { userId }] as const,
} as const;
