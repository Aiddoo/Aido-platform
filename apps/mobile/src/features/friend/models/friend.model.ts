import { z } from 'zod';

// ============================================================
// 친구 요청 사용자 스키마
// ============================================================

/** 친구 요청 사용자 도메인 모델 */
export const friendRequestUserSchema = z.object({
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  requestedAt: z.date(),
});
export type FriendRequestUser = z.infer<typeof friendRequestUserSchema>;

// ============================================================
// 친구 요청 목록 스키마
// ============================================================

/** 받은 친구 요청 목록 결과 */
export const receivedRequestsResultSchema = z.object({
  requests: z.array(friendRequestUserSchema),
  totalCount: z.number(),
  hasMore: z.boolean(),
});
export type ReceivedRequestsResult = z.infer<typeof receivedRequestsResultSchema>;

/** 보낸 친구 요청 목록 결과 */
export const sentRequestsResultSchema = z.object({
  requests: z.array(friendRequestUserSchema),
  totalCount: z.number(),
  hasMore: z.boolean(),
});
export type SentRequestsResult = z.infer<typeof sentRequestsResultSchema>;

// ============================================================
// 친구 스키마
// ============================================================

/** 친구 도메인 모델 */
export const friendUserSchema = z.object({
  followId: z.string(),
  id: z.string(),
  userTag: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  friendsSince: z.date(),
});
export type FriendUser = z.infer<typeof friendUserSchema>;

/** 친구 목록 결과 */
export const friendsResultSchema = z.object({
  friends: z.array(friendUserSchema),
  totalCount: z.number(),
  hasMore: z.boolean(),
});
export type FriendsResult = z.infer<typeof friendsResultSchema>;

// ============================================================
// 친구 요청 보내기 스키마
// ============================================================

/** 친구 요청 보내기 결과 */
export const sendRequestResultSchema = z.object({
  message: z.string(),
  autoAccepted: z.boolean(),
});
export type SendRequestResult = z.infer<typeof sendRequestResultSchema>;

// ============================================================
// Policy
// ============================================================

/** Friend 도메인 비즈니스 규칙 */
export const FriendPolicy = {
  /** 태그 형식: #0000 ~ #9999 */
  isValidTag(tag: string): boolean {
    return /^#\d{4}$/.test(tag);
  },
} as const;
