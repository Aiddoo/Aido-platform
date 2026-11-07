import { z } from 'zod';

export const notificationListQueryKeySchema = z.object({ unreadOnly: z.boolean().optional() });
