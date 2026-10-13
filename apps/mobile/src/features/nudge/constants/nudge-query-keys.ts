export const NUDGE_QUERY_KEYS = {
  all: ['todo', 'nudge'] as const,
  // 콕 찌르기 (Nudge)
  nudgeInteractions: () => [...NUDGE_QUERY_KEYS.all, 'interaction'] as const,
  nudgeInteractionAvailability: () =>
    [...NUDGE_QUERY_KEYS.nudgeInteractions(), 'availability'] as const,
  nudgeInteractionList: (direction: 'received' | 'sent') =>
    [...NUDGE_QUERY_KEYS.nudgeInteractions(), 'list', { direction }] as const,
  nudgeInteraction: (nudgeId: number) =>
    [...NUDGE_QUERY_KEYS.nudgeInteractions(), 'detail', { nudgeId }] as const,
  nudgeThanks: (todoId: number) =>
    [...NUDGE_QUERY_KEYS.nudgeInteractions(), 'thanks', { todoId }] as const,
  nudgeLimit: () => [...NUDGE_QUERY_KEYS.all, 'limit'] as const,
  nudgeCooldown: (userId: string) => [...NUDGE_QUERY_KEYS.all, 'cooldown', userId] as const,
  remindNudgeCooldown: (userId: string) =>
    [...NUDGE_QUERY_KEYS.all, 'remind-cooldown', userId] as const,
} as const;
