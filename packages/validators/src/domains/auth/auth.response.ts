/**
 * Auth Response 스키마
 *
 * 인증 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { DEVICE_TYPES, USER_STATUS } from './auth.constants';

// ============================================
// 공통 스키마
// ============================================

/** 사용자 상태 스키마 */
export const userStatusSchema = z.enum(USER_STATUS).describe('사용자 계정 상태');

/** 디바이스 타입 스키마 */
export const deviceTypeEnumSchema = z.enum(DEVICE_TYPES).describe('기기 타입');

// ============================================
// JWT 토큰 응답
// ============================================

/**
 * 로그인/이메일인증 응답 (userId 포함)
 * @description login, verifyEmail 엔드포인트에서 사용
 */
export const authTokensSchema = z
  .object({
    userId: z.string().cuid().describe('사용자 고유 ID'),
    accessToken: z.string().describe('JWT 액세스 토큰'),
    refreshToken: z.string().describe('JWT 리프레시 토큰'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
  })
  .describe('인증 토큰 정보');

export type AuthTokens = z.infer<typeof authTokensSchema>;

/**
 * 토큰 갱신 응답 (userId 없음)
 * @description refresh 엔드포인트에서 사용
 */
export const refreshTokensSchema = z
  .object({
    accessToken: z.string().describe('JWT 액세스 토큰'),
    refreshToken: z.string().describe('JWT 리프레시 토큰'),
  })
  .describe('토큰 갱신 응답');

export type RefreshTokens = z.infer<typeof refreshTokensSchema>;

// ============================================
// 사용자 프로필 응답
// ============================================

export const userProfileSchema = z
  .object({
    id: z.string().cuid().describe('사용자 고유 ID'),
    email: z.string().email().describe('이메일 주소'),
    emailVerifiedAt: nullableDatetimeSchema.describe('이메일 인증 완료 시각 (미인증 시 null)'),
    status: userStatusSchema,
    createdAt: datetimeSchema.describe('계정 생성 시각'),
    updatedAt: datetimeSchema.describe('계정 정보 수정 시각'),
  })
  .describe('사용자 프로필 정보');

export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * JWT 페이로드에서 추출된 사용자 정보 (req.user)
 * @description Passport JWT Strategy에서 반환하는 타입
 * @note 프로필 정보는 JWT에 포함되지 않으므로 별도 조회 필요
 */
export const currentUserPayloadSchema = z
  .object({
    userId: z.string().cuid().describe('사용자 고유 ID'),
    email: z.string().email().describe('이메일 주소'),
    sessionId: z.string().cuid().describe('현재 세션 ID'),
  })
  .describe('JWT 페이로드 사용자 정보');

export type CurrentUserPayload = z.infer<typeof currentUserPayloadSchema>;

/**
 * 현재 세션 사용자 정보 (getMe 응답)
 * @description 현재 인증된 사용자의 기본 정보
 */
export const currentUserSchema = currentUserPayloadSchema
  .extend({
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
  })
  .describe('현재 사용자 정보');

export type CurrentUser = z.infer<typeof currentUserSchema>;

// ============================================
// 세션 정보 응답
// ============================================

export const sessionInfoSchema = z
  .object({
    id: z.string().cuid().describe('세션 고유 ID'),
    deviceName: z.string().nullable().describe('기기 이름'),
    deviceType: deviceTypeEnumSchema.nullable().describe('기기 타입'),
    ipAddress: z.string().nullable().describe('접속 IP 주소'),
    userAgent: z.string().nullable().describe('User-Agent 문자열'),
    lastActiveAt: datetimeSchema.describe('마지막 활동 시각'),
    createdAt: datetimeSchema.describe('세션 생성 시각'),
    isCurrent: z.boolean().describe('현재 세션 여부'),
  })
  .describe('세션 정보');

export type SessionInfo = z.infer<typeof sessionInfoSchema>;

export const sessionListSchema = z.array(sessionInfoSchema).describe('활성 세션 목록');

export type SessionList = z.infer<typeof sessionListSchema>;

/**
 * 세션 목록 응답 (래핑된 형태)
 * @description getSessions 엔드포인트에서 사용
 */
export const sessionListResponseSchema = z
  .object({
    sessions: z.array(sessionInfoSchema),
  })
  .describe('활성 세션 목록 응답');

export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

// ============================================
// 로그인 응답
// ============================================

/**
 * 로그인 응답
 * @description authTokensSchema와 동일 (하위 호환성 유지)
 */
export const loginResponseSchema = authTokensSchema.describe('로그인 응답');

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ============================================
// 회원가입 응답
// ============================================

export const registerResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    email: z.string().email().describe('가입한 이메일 주소'),
  })
  .describe('회원가입 응답');

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

// ============================================
// 이메일 인증 응답
// ============================================

/**
 * 이메일 인증 완료 응답
 * @description authTokensSchema와 동일 (하위 호환성 유지)
 */
export const verifyEmailResponseSchema = authTokensSchema.describe('이메일 인증 완료 응답');

export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

// ============================================
// 토큰 갱신 응답
// ============================================

/**
 * 토큰 갱신 응답
 * @description refreshTokensSchema와 동일 (하위 호환성 유지)
 */
export const refreshTokensResponseSchema = refreshTokensSchema.describe('토큰 갱신 응답');

export type RefreshTokensResponse = z.infer<typeof refreshTokensResponseSchema>;

// ============================================
// 비밀번호 관련 응답
// ============================================

export const forgotPasswordResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    email: z.string().email().describe('비밀번호 재설정 이메일을 발송한 주소'),
  })
  .describe('비밀번호 찾기 응답');

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('비밀번호 재설정 완료 응답');

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

export const changePasswordResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('비밀번호 변경 완료 응답');

export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;

// ============================================
// 로그아웃 응답
// ============================================

export const logoutResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('로그아웃 응답');

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

// ============================================
// 인증 코드 재발송 응답
// ============================================

export const resendVerificationResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    email: z.string().email().describe('인증 코드를 발송한 이메일 주소'),
    retryAfterSeconds: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('재발송 가능까지 남은 시간 (초)'),
  })
  .describe('인증 코드 재발송 응답');

export type ResendVerificationResponse = z.infer<typeof resendVerificationResponseSchema>;

// ============================================
// 프로필 수정 응답
// ============================================

export const updateProfileResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    name: z.string().nullable().describe('수정된 이름'),
    profileImage: z.string().nullable().describe('수정된 프로필 이미지 URL'),
  })
  .describe('프로필 수정 응답');

export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

// ============================================
// OAuth 소셜 로그인 응답
// ============================================

/** OAuth Provider 타입 */
export const oauthProviderEnumSchema = z
  .enum(['APPLE', 'GOOGLE', 'KAKAO', 'NAVER'])
  .describe('소셜 로그인 제공자');

/**
 * Apple 로그인 응답
 * @description authTokensSchema와 동일 (소셜 로그인도 동일한 토큰 발급)
 */
export const appleLoginResponseSchema = authTokensSchema.describe('Apple 로그인 응답');

export type AppleLoginResponse = z.infer<typeof appleLoginResponseSchema>;

/**
 * 연결된 소셜 계정 정보
 */
export const linkedAccountSchema = z
  .object({
    provider: oauthProviderEnumSchema,
    providerAccountId: z.string().describe('제공자 측 계정 고유 ID'),
    linkedAt: datetimeSchema.describe('계정 연결 시각'),
  })
  .describe('연결된 소셜 계정 정보');

export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

/**
 * 연결된 소셜 계정 목록 응답
 */
export const linkedAccountsResponseSchema = z
  .object({
    accounts: z.array(linkedAccountSchema).describe('연결된 소셜 계정 목록'),
  })
  .describe('연결된 소셜 계정 목록 응답');

export type LinkedAccountsResponse = z.infer<typeof linkedAccountsResponseSchema>;

/**
 * 소셜 계정 연결 해제 응답
 */
export const unlinkAccountResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    provider: oauthProviderEnumSchema.describe('연결 해제된 제공자'),
  })
  .describe('소셜 계정 연결 해제 응답');

export type UnlinkAccountResponse = z.infer<typeof unlinkAccountResponseSchema>;

// ============================================
// 에러 응답
// ============================================

/** 인증 에러 코드 (주요 코드) */
export const authErrorCodeSchema = z
  .enum([
    // 공통
    'USER_NOT_FOUND',
    'INVALID_PARAMETER',
    'INTERNAL_SERVER_ERROR',
    // 인증/토큰
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'TOKEN_REVOKED',
    'AUTHENTICATION_REQUIRED',
    'INVALID_CREDENTIALS',
    // 소셜 로그인
    'SOCIAL_AUTH_FAILED',
    'SOCIAL_ACCOUNT_NOT_LINKED',
    'SOCIAL_PROVIDER_ERROR',
    // 회원가입
    'EMAIL_ALREADY_REGISTERED',
    'EMAIL_NOT_VERIFIED',
  ])
  .describe('인증 에러 코드');

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

/** 인증 에러 객체 */
export const authErrorSchema = z
  .object({
    code: authErrorCodeSchema.or(z.string()), // Unknown codes fallback
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .describe('인증 에러 객체');

export type AuthError = z.infer<typeof authErrorSchema>;
