import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { nudgeDirectionSchema } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { z } from 'zod';

import { notificationCategorySchema } from '../domains/notification.model';

/** 알림 화면의 분류(`?category=`)와 받은 알림·보낸 콕(`?direction=`) */
export const notificationParamsSchema = z.object({
  category: notificationCategorySchema.catch(NOTIFICATION_CATEGORY.ALL),
  direction: nudgeDirectionSchema.catch('received'),
});

export type NotificationDirection = z.output<typeof notificationParamsSchema>['direction'];
