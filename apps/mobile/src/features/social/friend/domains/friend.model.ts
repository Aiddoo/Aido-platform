import {
  type GetFollowsQuery,
  PREMIUM_FEATURES,
  USER_SEARCH_QUERY_LENGTH,
  userTagParamSchema,
} from '@aido/api';
import { friendLimitErrorDetailsSchema } from '@aido/api/errors';
import { z } from 'zod';

const friendUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  followId: z.string(),
  friendsSince: z.date(),
});
export type FriendUser = z.infer<typeof friendUserSchema>;

const friendRequestSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

const searchedUserSchema = z.object({
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
function isValidTag(tag: string): boolean {
  return userTagParamSchema.shape.userTag.safeParse(tag.trim()).success;
}

function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= USER_SEARCH_QUERY_LENGTH.MIN;
}

function hasValidUserTag(user: Pick<SearchedUser, 'userTag'>): boolean {
  return isValidTag(user.userTag);
}

function hasValidSearchQuery(input: FriendSearchInput): boolean {
  return isValidSearchQuery(input.query);
}

/**
 * 친구 한도에 닿았을 때 안내할 인원. 초대로 늘어난 자리는 서버가 FOLLOW_0909 details.limit으로 알려 준다.
 * 없으면 내 정보의 친구 한도(entitlements), 그것도 없으면 카탈로그의 무료 한도다
 */
export function resolveFriendLimit(
  details: Record<string, unknown> | undefined,
  knownLimit: number | null,
) {
  const parsed = friendLimitErrorDetailsSchema.safeParse(details);
  if (parsed.success) {
    return parsed.data.limit;
  }
  return knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}

export type FriendLimitDialog = { type: 'invite'; limit: number } | { type: 'subscribe' };

/** 친구 한도(FOLLOW_0909)에서 초대를 쓸 수 있으면 구독 대신 친구 초대로 자리를 늘리는 길을 먼저 보인다 */
export function resolveFriendLimitDialog(
  details: Record<string, unknown> | undefined,
  isInviteAvailable: boolean,
  knownLimit: number | null,
): FriendLimitDialog {
  return isInviteAvailable
    ? { type: 'invite', limit: resolveFriendLimit(details, knownLimit) }
    : { type: 'subscribe' };
}

export const FriendPolicy = {
  isValidTag: hasValidUserTag,
  isValidSearchQuery: hasValidSearchQuery,
  friendLimit: resolveFriendLimit,
  friendLimitDialog: resolveFriendLimitDialog,
} as const;
