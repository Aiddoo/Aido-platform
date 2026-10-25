import { FOLLOW_LIMITS } from '@aido/api';
import { friendLimitErrorDetailsSchema } from '@aido/api/errors';
import { z } from 'zod';

export const friendUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  followId: z.string(),
  friendsSince: z.date(),
});
export type FriendUser = z.infer<typeof friendUserSchema>;

export const friendRequestSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

export const searchedUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  isFollowing: z.boolean(),
  isFollower: z.boolean(),
  isFriend: z.boolean(),
  requestPending: z.boolean(),
});
export type SearchedUser = z.infer<typeof searchedUserSchema>;

const sendRequestResultSchema = z.object({ autoAccepted: z.boolean() });
export type SendRequestResult = z.infer<typeof sendRequestResultSchema>;
const paginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
});
export type PaginationParams = z.infer<typeof paginationParamsSchema>;
const friendSearchInputSchema = z.object({ query: z.string() });
type FriendSearchInput = z.infer<typeof friendSearchInputSchema>;

/** 검색어 최소 길이 (서버 searchUsersQuerySchema q.min(2)와 동일) */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** userTag: 8자리 영문 대문자·숫자만 허용 (@aido/api userTagParamSchema와 동일) */
export function isValidTag(tag: string): boolean {
  return /^[A-Z0-9]{8}$/.test(tag.trim());
}

export function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}

export function hasValidUserTag(user: Pick<SearchedUser, 'userTag'>): boolean {
  return isValidTag(user.userTag);
}

export function hasValidSearchQuery(input: FriendSearchInput): boolean {
  return isValidSearchQuery(input.query);
}

/** 친구 한도에 닿았을 때 안내할 인원. 초대로 늘어난 자리는 서버가 FOLLOW_0909 details.limit으로 알려 준다 */
export function resolveFriendLimit(details: Record<string, unknown> | undefined) {
  const parsed = friendLimitErrorDetailsSchema.safeParse(details);
  return parsed.success ? parsed.data.limit : FOLLOW_LIMITS.FREE_MAX_FRIENDS;
}

export const FriendPolicy = {
  isValidTag: hasValidUserTag,
  isValidSearchQuery: hasValidSearchQuery,
  friendLimit: resolveFriendLimit,
} as const;
