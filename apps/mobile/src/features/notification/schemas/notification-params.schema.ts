import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { nudgeDirectionSchema } from '@src/features/social/nudge/schemas/nudge-interaction-query-key.schema';

import { notificationCategorySchema } from '../domains/notification.model';

/** 알림 화면의 분류(`?category=`) */
export const notificationCategoryViewSchema = notificationCategorySchema.catch(
  NOTIFICATION_CATEGORY.ALL,
);

/** 받은 알림·보낸 콕(`?direction=`) */
export const notificationDirectionViewSchema = nudgeDirectionSchema.catch('received');
