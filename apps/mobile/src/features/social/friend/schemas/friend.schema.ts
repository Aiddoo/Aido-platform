import {
  friendRequestUserSchema as friendRequestUserContractSchema,
  friendsListResponseSchema,
  friendUserSchema as friendUserContractSchema,
  getFollowsQuerySchema,
  type ReorderFriendInput as ReorderFriendContractInput,
  receivedRequestsResponseSchema,
  reorderFriendResponseSchema,
  searchUsersQuerySchema,
  searchUsersResponseSchema,
  type searchUserSchema,
  sendFriendRequestResponseSchema,
  userTagParamSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 서버 경로 검증(userTagParamSchema)과 같은 규칙이다 */
export const userTagSchema = userTagParamSchema.shape.userTag;

/** 서버가 받는 Aido ID 형식(8자 영숫자 대문자)인지 */
export function isUserTagFormat(value: string): boolean {
  return userTagSchema.safeParse(value).success;
}

const friendUserSchema = friendUserContractSchema.extend({ friendsSince: instantSchema });
export type FriendUser = z.infer<typeof friendUserSchema>;

/** 친구 목록 캐시(무한 조회)의 모양. 영속 캐시 복원 값을 검증할 때 쓴다 */
export const friendUserPagesSchema = z.object({
  pages: z.array(
    z.object({
      items: z.array(friendUserSchema),
      totalCount: z.number(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable().optional(),
    }),
  ),
  pageParams: z.array(z.unknown()),
});

const friendRequestSchema = friendRequestUserContractSchema.extend({
  requestedAt: instantSchema,
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

export type SearchedUser = z.infer<typeof searchUserSchema>;

export const friendsPageSchema = friendsListResponseSchema.extend({
  friends: z.array(friendUserSchema),
});

/** 받은 요청과 보낸 요청은 응답 모양이 같다 */
export const friendRequestsPageSchema = receivedRequestsResponseSchema.extend({
  requests: z.array(friendRequestSchema),
});

export const searchedUsersPageSchema = searchUsersResponseSchema;

export type FriendsPageDto = z.output<typeof friendsPageSchema>;
export type FriendRequestsPageDto = z.output<typeof friendRequestsPageSchema>;
export type SearchedUsersPageDto = z.output<typeof searchedUsersPageSchema>;

export const sendRequestResultSchema = sendFriendRequestResponseSchema.pick({
  autoAccepted: true,
});
export type SendRequestResult = z.infer<typeof sendRequestResultSchema>;

export const reorderedFriendSchema = reorderFriendResponseSchema.extend({
  friend: friendUserSchema,
});

/** 친구·요청 목록 페이지 입력. 생략하면 서버 기본값(limit 20)을 쓴다 */
/** 계약은 문자열 query를 숫자로 바꾼다. 앱은 바꾼 뒤의 값을 보내고 기본값이 있는 칸은 생략한다 */
const paginationQuerySchema = getFollowsQuerySchema.partial();
export type PaginationQuery = z.output<typeof paginationQuerySchema>;

/** 서버의 검색어 칸 `q`를 앱에서는 `query`로 부른다 */
const searchUsersAppQuerySchema = searchUsersQuerySchema
  .pick({ cursor: true, limit: true })
  .partial()
  .extend({ query: searchUsersQuerySchema.shape.q });
export type SearchUsersQuery = z.output<typeof searchUsersAppQuerySchema>;

export type ReorderFriendInput = ReorderFriendContractInput;
