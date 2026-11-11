import { PREMIUM_FEATURES, USER_SEARCH_QUERY_LENGTH } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

// 서버 경로 검증(userTagParamSchema)과 같은 규칙이다
const userTagSchema = z
  .string()
  .length(8)
  .regex(/^[A-Z0-9]+$/u);

const friendProfileSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
});

export const friendUserSchema = friendProfileSchema.extend({
  followId: z.string(),
  friendsSince: instantSchema,
});
export type FriendUser = z.infer<typeof friendUserSchema>;

export const friendRequestSchema = friendProfileSchema.extend({
  requestedAt: instantSchema,
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

export const searchedUserSchema = friendProfileSchema.extend({
  isFriend: z.boolean(),
  requestPending: z.boolean(),
});
export type SearchedUser = z.infer<typeof searchedUserSchema>;

const sendFriendRequestResultSchema = z.object({
  autoAccepted: z.boolean(),
});
export type SendFriendRequestResult = z.infer<typeof sendFriendRequestResultSchema>;

const friendUserPageSchema = cursorPageSchema(friendUserSchema, z.string()).extend({
  totalCount: z.number(),
});
export type FriendUserPage = z.infer<typeof friendUserPageSchema>;

const friendRequestPageSchema = cursorPageSchema(friendRequestSchema, z.string()).extend({
  totalCount: z.number(),
});
export type FriendRequestPage = z.infer<typeof friendRequestPageSchema>;

const searchedUserPageSchema = cursorPageSchema(searchedUserSchema, z.string());
export type SearchedUserPage = z.infer<typeof searchedUserPageSchema>;

// 영속 캐시 복원 값을 검증할 때 쓴다
export const friendUserPagesSchema = z.object({
  pages: z.array(friendUserPageSchema),
  pageParams: z.array(z.unknown()),
});

type RequestState = 'friend' | 'pending' | 'none';

interface FriendLimitInput {
  /** 친구 한도(FOLLOW_0909) 오류가 알려 준 인원 */
  serverLimit: number | null;
  /** 내 정보(entitlements)의 친구 한도 */
  knownLimit: number | null;
}

// 입력한 태그·검색어 규칙이라 Policy 밖에 둔다
export function isValidUserTag(userTag: string) {
  return userTagSchema.safeParse(userTag.trim()).success;
}

export function isValidSearchQuery(query: string) {
  return query.trim().length >= USER_SEARCH_QUERY_LENGTH.MIN;
}

// 이미 친구면 요청 대기보다 먼저다
export function getRequestState(user: SearchedUser): RequestState {
  if (user.isFriend) {
    return 'friend';
  }
  if (user.requestPending) {
    return 'pending';
  }

  return 'none';
}

// 초대로 늘어난 자리는 서버 오류가 알려 주고, 없으면 내 정보, 그것도 없으면 카탈로그의 무료 한도다
export function getFriendLimit({ serverLimit, knownLimit }: FriendLimitInput) {
  return serverLimit ?? knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}

export const FriendPolicy = {
  getRequestState,
  getFriendLimit,
} as const;
