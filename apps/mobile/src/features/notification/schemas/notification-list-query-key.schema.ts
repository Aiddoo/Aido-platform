import { z } from 'zod';

import { notificationCategorySchema } from './notification.schema';

const notificationListQueryKeySchema = z.object({
  category: notificationCategorySchema.optional(),
  limit: z.int(),
});
export type NotificationListQueryKey = z.infer<typeof notificationListQueryKeySchema>;
