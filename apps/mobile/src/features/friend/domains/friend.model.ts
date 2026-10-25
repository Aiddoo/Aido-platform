import {
  FOLLOW_LIMITS,
  type GetFollowsQuery,
  USER_SEARCH_QUERY_LENGTH,
  userTagParamSchema,
} from '@aido/api';
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
/** 친구·요청 목록 페이지 입력. 생략하면 서버 기본값(limit 20)을 쓴다 */
export type PaginationParams = Partial<GetFollowsQuery>;
const friendSearchInputSchema = z.object({ query: z.string() });
type FriendSearchInput = z.infer<typeof friendSearchInputSchema>;

/** userTag: 서버 경로 검증(userTagParamSchema)과 같은 규칙 */
export function isValidTag(tag: string): boolean {
  return userTagParamSchema.shape.userTag.safeParse(tag.trim()).success;
}

export function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= USER_SEARCH_QUERY_LENGTH.MIN;
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

export type FriendLimitDialog = { type: 'invite'; limit: number } | { type: 'subscribe' };

/** 친구 한도(FOLLOW_0909)에서 초대를 쓸 수 있으면 구독 대신 친구 초대로 자리를 늘리는 길을 먼저 보인다 */
export function resolveFriendLimitDialog(
  details: Record<string, unknown> | undefined,
  isInviteAvailable: boolean,
): FriendLimitDialog {
  return isInviteAvailable
    ? { type: 'invite', limit: resolveFriendLimit(details) }
    : { type: 'subscribe' };
}

export const FriendPolicy = {
  isValidTag: hasValidUserTag,
  isValidSearchQuery: hasValidSearchQuery,
  friendLimit: resolveFriendLimit,
  friendLimitDialog: resolveFriendLimitDialog,
} as const;
