import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

export const blockedUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
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
