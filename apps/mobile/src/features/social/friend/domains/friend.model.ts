import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

export const friendUserSchema = userSummarySchema.extend({
  followId: z.string(),
  friendsSince: instantSchema,
});
export type FriendUser = z.infer<typeof friendUserSchema>;

export const friendUserPageSchema = cursorPageSchema(friendUserSchema, z.string()).extend({
  totalCount: z.number(),
});
export type FriendUserPage = z.infer<typeof friendUserPageSchema>;
