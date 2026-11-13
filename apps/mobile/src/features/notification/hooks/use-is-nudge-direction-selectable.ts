import { NOTIFICATION_CATEGORY, type NotificationCategory } from '@aido/api/vocabulary';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '@src/features/social/nudge/queries/todo-nudge.queries';
import { useQuery } from '@tanstack/react-query';

/** 받은 알림·보낸 콕을 나눠 보는 것은 소셜 알림뿐이고 콕 상호작용을 쓸 수 있어야 한다. 응답 전에는 나누지 않는다 */
export function useIsNudgeDirectionSelectable(category: NotificationCategory) {
  const { data: isNudgeInteractionAvailable = false } = useQuery(
    useGetNudgeInteractionAvailabilityQueryOptions(),
  );

  return category === NOTIFICATION_CATEGORY.SOCIAL && isNudgeInteractionAvailable;
}
