import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import {
  type NotificationCategory,
  notificationCategorySchema,
} from '../domains/notification.model';

const notificationCategorySearchSchema = z.object({
  category: notificationCategorySchema.catch(NOTIFICATION_CATEGORY.ALL),
});

/** 알림 URL의 `category` param을 검증해 읽고 바꾼다. */
export function useNotificationCategoryParam(): readonly [
  NotificationCategory,
  (category: NotificationCategory) => void,
] {
  const { category } = notificationCategorySearchSchema.parse(useLocalSearchParams());
  const setCategory = useCallback(
    (value: NotificationCategory) => router.setParams({ category: value }),
    [],
  );

  return [category, setCategory] as const;
}
