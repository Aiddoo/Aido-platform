/**
 * Follow Request DTO 스키마
 *
 * 친구 요청 시스템 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 공통 파라미터
// ============================================

/** 사용자 ID 파라미터 */
export const userIdParamSchema = z
  .object({
    userId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('대상 사용자의 ID'),
  })
  .describe('사용자 ID 파라미터');

export type UserIdParam = z.infer<typeof userIdParamSchema>;

// ============================================
// 친구 요청 보내기
// ============================================

/** 사용자 태그 파라미터 스키마 */
export const userTagParamSchema = z
  .object({
    userTag: z
      .string()
      .length(8, '사용자 태그는 8자리입니다')
      .regex(/^[A-Z0-9]+$/, '사용자 태그는 영문 대문자와 숫자만 허용됩니다')
      .describe('사용자 태그 (8자리 영숫자)'),
  })
  .describe('사용자 태그 파라미터');

export type UserTagParam = z.infer<typeof userTagParamSchema>;

/** 친구 요청 보내기 (URL 파라미터) - userTag 기반 */
export const sendFriendRequestParamSchema = userTagParamSchema.describe(
  '친구 요청 보내기 파라미터',
);

export type SendFriendRequestParam = z.infer<typeof sendFriendRequestParamSchema>;

// ============================================
// 친구 요청 수락/거절
// ============================================

/** 친구 요청 수락 파라미터 */
export const acceptFriendRequestParamSchema = userIdParamSchema.describe('친구 요청 수락 파라미터');

export type AcceptFriendRequestParam = z.infer<typeof acceptFriendRequestParamSchema>;

/** 친구 요청 거절 파라미터 */
export const rejectFriendRequestParamSchema = userIdParamSchema.describe('친구 요청 거절 파라미터');

export type RejectFriendRequestParam = z.infer<typeof rejectFriendRequestParamSchema>;

// ============================================
// 친구 삭제 / 요청 철회
// ============================================

/** 친구 삭제 파라미터 */
export const removeFriendParamSchema = userIdParamSchema.describe('친구 삭제 파라미터');

export type RemoveFriendParam = z.infer<typeof removeFriendParamSchema>;

/** 친구 요청 철회 파라미터 */
export const cancelFriendRequestParamSchema = userIdParamSchema.describe('친구 요청 철회 파라미터');

export type CancelFriendRequestParam = z.infer<typeof cancelFriendRequestParamSchema>;

// ============================================
// 목록 조회 쿼리
// ============================================

/** 친구/요청 목록 조회 쿼리 */
export const getFollowsQuerySchema = z
  .object({
    cursor: z.cuid().optional().describe('페이지네이션 커서'),
    limit: z
      .string()
      .regex(/^\d+$/, '숫자만 입력 가능합니다')
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .optional()
      .default(20)
      .describe('한 페이지당 항목 수 (1-50, 기본값: 20)'),
  })
  .describe('친구/요청 목록 조회 쿼리');

export type GetFollowsQuery = z.infer<typeof getFollowsQuerySchema>;

/** 친구 목록 조회 쿼리 (검색 지원) */
export const getFriendsQuerySchema = z
  .object({
    cursor: z.cuid().optional().describe('페이지네이션 커서'),
    limit: z
      .string()
      .regex(/^\d+$/, '숫자만 입력 가능합니다')
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .optional()
      .default(20)
      .describe('한 페이지당 항목 수 (1-50, 기본값: 20)'),
    search: z.string().max(50, '검색어는 50자 이내여야 합니다').optional().describe('태그로 검색'),
  })
  .describe('친구 목록 조회 쿼리');

export type GetFriendsQuery = z.infer<typeof getFriendsQuerySchema>;

// ============================================
// 친구 투두 조회
// ============================================

/** 친구 투두 조회 파라미터 */
export const getFriendTodosParamSchema = userIdParamSchema.describe('친구 투두 조회 파라미터');

export type GetFriendTodosParam = z.infer<typeof getFriendTodosParamSchema>;
