import { z } from 'zod';

import { notificationCategorySchema } from '../domains/notification.model';

const notificationListQueryKeySchema = z.object({
  category: notificationCategorySchema.optional(),
  limit: z.int(),
});
export type NotificationListQueryKey = z.infer<typeof notificationListQueryKeySchema>;
