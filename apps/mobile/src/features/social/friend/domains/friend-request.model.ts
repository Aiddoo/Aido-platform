import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

export const friendRequestSchema = userSummarySchema.extend({
  requestedAt: instantSchema,
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

const friendRequestPageSchema = cursorPageSchema(friendRequestSchema, z.string()).extend({
  totalCount: z.number(),
});
export type FriendRequestPage = z.infer<typeof friendRequestPageSchema>;

const sendFriendRequestResultSchema = z.object({
  autoAccepted: z.boolean(),
});
export type SendFriendRequestResult = z.infer<typeof sendFriendRequestResultSchema>;
