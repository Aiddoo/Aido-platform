import {
  blockedUserSchema as blockedUserContractSchema,
  blockedUsersResponseSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const blockedUserSchema = blockedUserContractSchema.extend({ blockedAt: instantSchema });
export type BlockedUser = z.infer<typeof blockedUserSchema>;

export const blockedUsersPageSchema = blockedUsersResponseSchema.extend({
  items: z.array(blockedUserSchema),
});
export type BlockedUsersPageDto = z.output<typeof blockedUsersPageSchema>;

/** 차단 확인·결과 문구에 쓰는 상대. 이름이 없으면 화면이 대체 이름을 넣는다 */
export interface BlockTarget {
  userId: string;
  displayName: string;
}
