import { z } from 'zod';

export const FriendUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  followId: z.string(),
  friendsSince: z.date(),
});
export type FriendUser = z.infer<typeof FriendUserSchema>;

export const FriendRequestSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

/** 사용자 검색 결과 (이름/태그 검색, 뷰어 기준 관계 상태 포함) */
export const SearchedUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  isFollowing: z.boolean(),
  isFollower: z.boolean(),
  isFriend: z.boolean(),
  requestPending: z.boolean(),
});
export type SearchedUser = z.infer<typeof SearchedUserSchema>;

export interface SendRequestResult {
  autoAccepted: boolean;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

/** 검색어 최소 길이 (서버 searchUsersQuerySchema q.min(2)와 동일) */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** userTag: 8자리 영문 대문자·숫자만 허용 (@aido/validators userTagParamSchema와 동일) */
export const FriendPolicy = {
  isValidTag(tag: string): boolean {
    return /^[A-Z0-9]{8}$/.test(tag.trim());
  },
  /** 검색어가 유효한 최소 길이(2자) 이상인지 (trim 후 판정) */
  isValidSearchQuery(query: string): boolean {
    return query.trim().length >= SEARCH_MIN_QUERY_LENGTH;
  },
} as const;
