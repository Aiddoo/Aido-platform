import { useView } from '@src/shared/hooks/use-view';

import {
  notificationCategoryViewSchema,
  notificationDirectionViewSchema,
} from '../schemas/notification-params.schema';

export function useNotificationCategory() {
  return useView('category', notificationCategoryViewSchema);
}

/** 받은 알림·보낸 콕. 나눠 볼 수 있는지는 `useIsNudgeDirectionSelectable`이 정한다 */
export function useNotificationDirection() {
  return useView('direction', notificationDirectionViewSchema);
}
