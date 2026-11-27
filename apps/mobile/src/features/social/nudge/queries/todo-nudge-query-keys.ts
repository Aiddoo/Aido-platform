import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { NudgeCooldown } from '../domains/nudge-cooldown.model';
import type { NudgeInteraction, NudgeInteractionPage } from '../domains/nudge-interaction.model';
import type { NudgeThanksCursor, NudgeThanksPreview } from '../domains/nudge-thanks-preview.model';
import type { NudgeDirection } from '../schemas/nudge-interaction-query-key.schema';

export const TODO_NUDGE_QUERY_KEYS = {
  all: ['nudge'] as const,
  interactions: () => [...TODO_NUDGE_QUERY_KEYS.all, 'interaction'] as const,
  interactionAvailability: () =>
    queryOptions<boolean>({
      queryKey: [...TODO_NUDGE_QUERY_KEYS.interactions(), 'availability'],
    }).queryKey,
  interactionLists: () => [...TODO_NUDGE_QUERY_KEYS.interactions(), 'list'] as const,
  interactionList: ({ direction }: { direction: NudgeDirection }) =>
    queryOptions<InfiniteData<NudgeInteractionPage, number | undefined>>({
      queryKey: [...TODO_NUDGE_QUERY_KEYS.interactionLists(), { direction }],
    }).queryKey,
  interaction: ({ nudgeId }: { nudgeId: number }) =>
    queryOptions<NudgeInteraction>({
      queryKey: [...TODO_NUDGE_QUERY_KEYS.interactions(), 'detail', { nudgeId }],
    }).queryKey,
  thanksPreview: ({ todoId }: { todoId: number }) =>
    queryOptions<InfiniteData<NudgeThanksPreview, NudgeThanksCursor | undefined>>({
      queryKey: [...TODO_NUDGE_QUERY_KEYS.interactions(), 'thanks', { todoId }],
    }).queryKey,
  remindCooldown: ({ userId }: { userId: string }) =>
    queryOptions<NudgeCooldown>({
      queryKey: [...TODO_NUDGE_QUERY_KEYS.all, 'remind-cooldown', { userId }],
    }).queryKey,
} as const;
