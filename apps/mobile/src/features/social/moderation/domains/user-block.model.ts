import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

export const blockedUserSchema = userSummarySchema.extend({
  blockedAt: instantSchema,
});
export type BlockedUser = z.infer<typeof blockedUserSchema>;

const blockedUserPageSchema = cursorPageSchema(blockedUserSchema, z.string()).extend({
  totalCount: z.number(),
});
export type BlockedUserPage = z.infer<typeof blockedUserPageSchema>;

// 이름이 없으면 화면이 대체 이름을 넣는다
const blockTargetSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
});
export type BlockTarget = z.infer<typeof blockTargetSchema>;
