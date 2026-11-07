import { useView } from '@src/shared/hooks/use-view';

import { notificationCategoryParamSchema } from '../schemas/notification-params.schema';

/** 알림 화면의 분류 탭. 화면과 목록이 같은 키를 읽는다 */
export function useNotificationCategory() {
  return useView('category', notificationCategoryParamSchema);
}
