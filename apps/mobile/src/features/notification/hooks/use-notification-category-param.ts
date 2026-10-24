import { NOTIFICATION_CATEGORY, getNotificationsQuerySchema } from '@aido/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

const notificationCategorySearchSchema = z.object({
  category: getNotificationsQuerySchema.shape.category.catch(NOTIFICATION_CATEGORY.ALL),
});

type NotificationCategoryParam = z.output<typeof notificationCategorySearchSchema>['category'];

/** 알림 URL의 `category` param을 검증해 읽고 바꾼다. */
export function useNotificationCategoryParam(): readonly [
  NotificationCategoryParam,
  (category: NotificationCategoryParam) => void,
] {
  const { category } = notificationCategorySearchSchema.parse(useLocalSearchParams());
  const setCategory = useCallback(
    (value: NotificationCategoryParam) => router.setParams({ category: value }),
    [],
  );

  return [category, setCategory] as const;
}
