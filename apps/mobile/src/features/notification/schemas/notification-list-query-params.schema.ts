import { z } from 'zod';

export const notificationListQueryParamsSchema = z.object({ unreadOnly: z.boolean().optional() });
