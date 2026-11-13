import { getFollowsQuerySchema, type reorderFriendSchema, searchUsersQuerySchema } from '@aido/api';
import type { z } from 'zod';

// 계약은 문자열 query를 숫자로 바꾼다. 앱은 바꾼 뒤의 값을 보내고 기본값이 있는 칸은 생략한다
const paginationQuerySchema = getFollowsQuerySchema.partial();
export type PaginationQuery = z.output<typeof paginationQuerySchema>;

// 서버의 검색어 칸 `q`를 앱에서는 `query`로 부른다
const searchUsersAppQuerySchema = searchUsersQuerySchema
  .pick({ cursor: true, limit: true })
  .partial()
  .extend({ query: searchUsersQuerySchema.shape.q });
export type SearchUsersQuery = z.output<typeof searchUsersAppQuerySchema>;

export type ReorderFriendInput = z.infer<typeof reorderFriendSchema>;
