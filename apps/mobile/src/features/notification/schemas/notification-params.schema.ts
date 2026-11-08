import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { nudgeDirectionSchema } from '@src/features/social/nudge/schemas/nudge-interaction.schema';

import { notificationCategorySchema } from '../domains/notification.model';

export const notificationCategoryParamSchema = notificationCategorySchema.catch(
  NOTIFICATION_CATEGORY.ALL,
);

export const notificationDirectionParamSchema = nudgeDirectionSchema.catch('received');
