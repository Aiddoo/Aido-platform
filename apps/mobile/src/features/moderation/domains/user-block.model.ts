import { blockedUserSchema } from '@aido/api';
import { z } from 'zod';

export const BlockedUserSchema = blockedUserSchema.extend({
  blockedAt: z.coerce.date(),
});

export type BlockedUser = z.output<typeof BlockedUserSchema>;

/** 차단 확인·결과 문구에 쓰는 상대. 이름이 없으면 화면이 대체 이름을 넣는다 */
export interface BlockTarget {
  userId: string;
  displayName: string;
}
