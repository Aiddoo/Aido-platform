import { z } from 'zod';

import { friendUserPageSchema } from '../domains/friend.model';

// 기기에 남긴 친구 목록 캐시(무한 쿼리 페이지)를 복원할 때 검증한다
export const friendUserPagesSchema = z.object({
  pages: z.array(friendUserPageSchema),
  pageParams: z.array(z.unknown()),
});
