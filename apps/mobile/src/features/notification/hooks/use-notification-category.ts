import { useView } from '@src/shared/hooks/use-view';

import { notificationCategoryParamSchema } from '../schemas/notification-params.schema';

export function useNotificationCategory() {
  return useView('category', notificationCategoryParamSchema);
}
