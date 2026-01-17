/**
 * Follow Request DTO 스키마
 *
 * 팔로우 관련 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 팔로우 요청
// ============================================

/** 사용자 태그로 팔로우 요청 */
export const followByTagSchema = z
  .object({
    userTag: z
      .string()
      .length(8, '사용자 태그는 8자리입니다')
      .regex(/^[A-Z0-9]+$/, '사용자 태그는 영문 대문자와 숫자만 허용됩니다')
      .describe('팔로우할 사용자의 태그 (8자리 영숫자)'),
  })
  .describe('사용자 태그로 팔로우 요청');

export type FollowByTagInput = z.infer<typeof followByTagSchema>;

/** 사용자 ID로 팔로우 요청 */
export const followByIdSchema = z
  .object({
    userId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('팔로우할 사용자의 ID'),
  })
  .describe('사용자 ID로 팔로우 요청');

export type FollowByIdInput = z.infer<typeof followByIdSchema>;

// ============================================
// 언팔로우 요청
// ============================================

/** 언팔로우 요청 */
export const unfollowSchema = z
  .object({
    userId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('언팔로우할 사용자의 ID'),
  })
  .describe('언팔로우 요청');

export type UnfollowInput = z.infer<typeof unfollowSchema>;

// ============================================
// 팔로워 삭제 요청
// ============================================

/** 팔로워 삭제 요청 (나를 팔로우한 사람 삭제) */
export const removeFollowerSchema = z
  .object({
    userId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('삭제할 팔로워의 사용자 ID'),
  })
  .describe('팔로워 삭제 요청');

export type RemoveFollowerInput = z.infer<typeof removeFollowerSchema>;
