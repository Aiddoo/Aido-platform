import { z } from 'zod';

/**
 * 친구 요청 사용자 도메인 모델
 * - DTO의 requestedAt(string)을 Date로 변환
 */
export const FriendRequestUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});

export type FriendRequestUser = z.infer<typeof FriendRequestUserSchema>;

/**
 * 받은 친구 요청 목록 도메인 모델
 */
export interface ReceivedRequestsResult {
  requests: FriendRequestUser[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * 보낸 친구 요청 목록 도메인 모델
 */
export interface SentRequestsResult {
  requests: FriendRequestUser[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * 친구 도메인 모델
 */
export const FriendUserSchema = z.object({
  followId: z.string(),
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  friendsSince: z.date(),
});

export type FriendUser = z.infer<typeof FriendUserSchema>;

/**
 * 친구 목록 도메인 모델
 */
export interface FriendsResult {
  friends: FriendUser[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * 친구 관련 비즈니스 규칙 (Policy)
 */
export const FriendPolicy = {
  /** 요청 취소 가능 여부 (본인이 보낸 요청만 취소 가능) */
  canCancelRequest: (): boolean => true,

  /** 친구 삭제 확인 필요 여부 (7일 이상 친구) */
  requiresDeleteConfirmation: (friendsSince: Date): boolean => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - friendsSince.getTime() > sevenDays;
  },

  /** 친구의 표시 이름 */
  getDisplayName: (user: { name: string | null; userTag: string }): string => {
    return user.name ?? user.userTag;
  },
};
