import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '@src/features/social/nudge/queries/todo-nudge.queries';
import type { NudgeDirection } from '@src/features/social/nudge/schemas/nudge-interaction-query-key.schema';
import { useView } from '@src/shared/hooks/use-view';
import { useQuery } from '@tanstack/react-query';

import {
  notificationCategoryParamSchema,
  notificationDirectionParamSchema,
} from '../schemas/notification-params.schema';

export function useNotificationCategory() {
  return useView('category', notificationCategoryParamSchema);
}

/** 받은 알림·보낸 콕. 나눠 보는 것은 소셜 알림뿐이고 콕 상호작용을 쓸 수 있어야 해서, 그 밖에는 받은 쪽을 보인다 */
export function useNotificationDirection() {
  const [category] = useNotificationCategory();
  const [direction, setDirection] = useView('direction', notificationDirectionParamSchema);
  const { data: isNudgeInteractionAvailable = false } = useQuery(
    useGetNudgeInteractionAvailabilityQueryOptions(),
  );
  const isDirectionSelectable =
    category === NOTIFICATION_CATEGORY.SOCIAL && isNudgeInteractionAvailable;
  const visibleDirection: NudgeDirection = isDirectionSelectable ? direction : 'received';

  return [{ direction: visibleDirection, isDirectionSelectable }, setDirection] as const;
}
