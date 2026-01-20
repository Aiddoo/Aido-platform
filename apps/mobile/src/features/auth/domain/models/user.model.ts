/**
 * Auth Domain Models
 *
 * 프론트엔드 도메인 모델을 정의합니다.
 * 서버 응답 형식과 동일한 필드명을 사용하지만,
 * Domain 레이어의 독립성을 위해 자체 스키마를 정의합니다.
 */

import { z } from 'zod';

// ===== 지원 스키마 =====

/**
 * ISO 8601 datetime 스키마
 * 입력은 String으로 검증하고, 출력은 Date 객체로 자동 변환합니다.
 */
const datetimeSchema = z
  .string()
  .datetime({ offset: true })
  .transform((date) => new Date(date));

const nullableDatetimeSchema = datetimeSchema.nullable();

/** 사용자 상태 */
const userStatusSchema = z.enum(['ACTIVE', 'LOCKED', 'SUSPENDED', 'PENDING_VERIFY']);

/** 구독 상태 */
const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']);

// ===== 인증 토큰 =====

/**
 * 인증 토큰 정보
 */
export const authTokensSchema = z.object({
  userId: z.string().cuid().describe('사용자 고유 ID'),
  accessToken: z.string().describe('JWT 액세스 토큰'),
  refreshToken: z.string().describe('JWT 리프레시 토큰'),
  name: z.string().nullable().describe('사용자 이름'),
  profileImage: z.string().nullable().describe('프로필 이미지 URL'),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

// ===== 현재 사용자 =====

/**
 * 현재 사용자 정보
 */
export const currentUserSchema = z.object({
  // === 기본 정보 ===
  userId: z.string().cuid().describe('사용자 고유 ID'),
  email: z.string().email().describe('이메일 주소'),
  sessionId: z.string().cuid().describe('현재 세션 ID'),

  // === 사용자 태그 (검색용) ===
  userTag: z.string().length(8).describe('사용자 태그 (8자리 영숫자, 해시태그 검색용)'),

  // === 계정 상태 ===
  status: userStatusSchema.describe('계정 상태'),
  emailVerifiedAt: nullableDatetimeSchema.describe('이메일 인증 완료 시점 (미인증 시 null)'),

  // === 구독 정보 ===
  subscriptionStatus: subscriptionStatusSchema.describe('구독 상태'),
  subscriptionExpiresAt: nullableDatetimeSchema.describe('구독 만료 시점 (무료 사용자는 null)'),

  // === 프로필 정보 ===
  name: z.string().nullable().describe('사용자 이름'),
  profileImage: z.string().nullable().describe('프로필 이미지 URL'),

  // === 메타데이터 ===
  createdAt: datetimeSchema.describe('가입 일시'),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

// ===== 요청 모델 =====

/**
 * OAuth 토큰 교환 요청
 */
export const exchangeCodeSchema = z.object({
  code: z
    .string()
    .min(1, '교환 코드가 필요합니다')
    .describe('OAuth 인증 후 발급된 일회용 교환 코드'),
});

export type ExchangeCodeInput = z.infer<typeof exchangeCodeSchema>;

/**
 * 토큰 갱신 요청
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다').describe('리프레시 토큰'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
