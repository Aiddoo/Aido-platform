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
    userId: z.cuid().describe('사용자 고유 ID'),
    accessToken: z.string().describe('JWT 액세스 토큰'),
    refreshToken: z.string().describe('JWT 리프레시 토큰'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
  })
  .describe('인증 토큰 정보')
  .meta({
    example: {
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwiZW1haWwiOiJkeWRhbHMzNDQwQGdtYWlsLmNvbSIsImlhdCI6MTcwNTQ4MzIwMH0.example',
      refreshToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDU0ODMyMDB9.example',
      name: '매튜',
      profileImage: 'https://example.com/profiles/matthew.jpg',
    },
  });

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
  .describe('토큰 갱신 응답')
  .meta({
    example: {
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwiZW1haWwiOiJkeWRhbHMzNDQwQGdtYWlsLmNvbSIsImlhdCI6MTcwNTQ4MzIwMH0.newtoken',
      refreshToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDU0ODMyMDB9.newtoken',
    },
  });

export type RefreshTokens = z.infer<typeof refreshTokensSchema>;

// ============================================
// 사용자 프로필 응답
// ============================================

export const userProfileSchema = z
  .object({
    id: z.cuid().describe('사용자 고유 ID'),
    email: z.email().describe('이메일 주소'),
    emailVerifiedAt: nullableDatetimeSchema.describe('이메일 인증 완료 시각 (미인증 시 null)'),
    status: userStatusSchema,
    createdAt: datetimeSchema.describe('계정 생성 시각'),
    updatedAt: datetimeSchema.describe('계정 정보 수정 시각'),
  })
  .describe('사용자 프로필 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0001qz0z8z8z8z8z',
      email: 'dydals3440@gmail.com',
      emailVerifiedAt: '2026-01-15T10:30:00.000Z',
      status: 'ACTIVE',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-17T14:00:00.000Z',
    },
  });

export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * JWT 페이로드에서 추출된 사용자 정보 (req.user)
 * @description Passport JWT Strategy에서 반환하는 타입
 * @note 프로필 정보는 JWT에 포함되지 않으므로 별도 조회 필요
 */
export const currentUserPayloadSchema = z
  .object({
    userId: z.cuid().describe('사용자 고유 ID'),
    email: z.email().describe('이메일 주소'),
    sessionId: z.cuid().describe('현재 세션 ID'),
  })
  .describe('JWT 페이로드 사용자 정보')
  .meta({
    example: {
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      email: 'dydals3440@gmail.com',
      sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
    },
  });

export type CurrentUserPayload = z.infer<typeof currentUserPayloadSchema>;

// ============================================
// 구독 상태 스키마
// ============================================

/** 구독 상태 enum */
export const SUBSCRIPTION_STATUS = ['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

/** 구독 상태 스키마 */
export const subscriptionStatusSchema = z
  .enum(SUBSCRIPTION_STATUS)
  .describe('구독 상태 (FREE: 무료, ACTIVE: 구독 중, EXPIRED: 만료, CANCELLED: 취소)');

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// ============================================
// 현재 사용자 정보 (확장)
// ============================================

/**
 * 현재 세션 사용자 정보 (getMe 응답)
 * @description 현재 인증된 사용자의 전체 정보 (비밀번호 제외)
 */
export const currentUserSchema = z
  .object({
    // === 기본 정보 ===
    userId: z.cuid().describe('사용자 고유 ID'),
    email: z.email().describe('이메일 주소'),
    sessionId: z.cuid().describe('현재 세션 ID'),

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
  })
  .describe('현재 사용자 정보')
  .meta({
    example: {
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      email: 'dydals3440@gmail.com',
      sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
      userTag: 'MATT2025',
      status: 'ACTIVE',
      emailVerifiedAt: '2026-01-15T10:30:00.000Z',
      subscriptionStatus: 'FREE',
      subscriptionExpiresAt: null,
      name: '매튜',
      profileImage: 'https://example.com/profiles/matthew.jpg',
      createdAt: '2026-01-01T09:00:00.000Z',
    },
  });

export type CurrentUser = z.infer<typeof currentUserSchema>;

// ============================================
// 세션 정보 응답
// ============================================

export const sessionInfoSchema = z
  .object({
    id: z.cuid().describe('세션 고유 ID'),
    deviceName: z.string().nullable().describe('기기 이름'),
    deviceType: deviceTypeEnumSchema.nullable().describe('기기 타입'),
    ipAddress: z.string().nullable().describe('접속 IP 주소'),
    userAgent: z.string().nullable().describe('User-Agent 문자열'),
    lastActiveAt: datetimeSchema.describe('마지막 활동 시각'),
    createdAt: datetimeSchema.describe('세션 생성 시각'),
    isCurrent: z.boolean().describe('현재 세션 여부'),
  })
  .describe('세션 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0002qz0z8z8z8z8z',
      deviceName: 'iPhone 15 Pro',
      deviceType: 'MOBILE',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      lastActiveAt: '2026-01-17T14:25:00.000Z',
      createdAt: '2026-01-15T10:30:00.000Z',
      isCurrent: true,
    },
  });

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
  .describe('활성 세션 목록 응답')
  .meta({
    example: {
      sessions: [
        {
          id: 'clz7x5p8k0002qz0z8z8z8z8z',
          deviceName: 'iPhone 15 Pro',
          deviceType: 'MOBILE',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          lastActiveAt: '2026-01-17T14:25:00.000Z',
          createdAt: '2026-01-15T10:30:00.000Z',
          isCurrent: true,
        },
        {
          id: 'clz7x5p8k0003qz0z8z8z8z8z',
          deviceName: 'MacBook Pro',
          deviceType: 'DESKTOP',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          lastActiveAt: '2026-01-16T20:00:00.000Z',
          createdAt: '2026-01-10T09:00:00.000Z',
          isCurrent: false,
        },
      ],
    },
  });

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
    email: z.email().describe('가입한 이메일 주소'),
  })
  .describe('회원가입 응답')
  .meta({
    example: {
      message: '인증 코드가 이메일로 발송되었습니다.',
      email: 'dydals3440@gmail.com',
    },
  });

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
  .describe('비밀번호 찾기 응답')
  .meta({
    example: {
      message: '비밀번호 재설정 링크가 이메일로 발송되었습니다.',
      email: 'dydals3440@gmail.com',
    },
  });

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('비밀번호 재설정 완료 응답')
  .meta({
    example: {
      message: '비밀번호가 성공적으로 변경되었습니다.',
    },
  });

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

export const changePasswordResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('비밀번호 변경 완료 응답')
  .meta({
    example: {
      message: '비밀번호가 성공적으로 변경되었습니다.',
    },
  });

export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;

// ============================================
// 로그아웃 응답
// ============================================

export const logoutResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('로그아웃 응답')
  .meta({
    example: {
      message: '로그아웃되었습니다.',
    },
  });

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
  .describe('인증 코드 재발송 응답')
  .meta({
    example: {
      message: '인증 코드가 재발송되었습니다.',
      email: 'dydals3440@gmail.com',
      retryAfterSeconds: 60,
    },
  });

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
  .describe('프로필 수정 응답')
  .meta({
    example: {
      message: '프로필이 수정되었습니다.',
      name: '매튜',
      profileImage: 'https://example.com/profiles/matthew.jpg',
    },
  });

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
  .describe('연결된 소셜 계정 정보')
  .meta({
    example: {
      provider: 'GOOGLE',
      providerAccountId: '102938475647382910',
      linkedAt: '2026-01-15T10:30:00.000Z',
    },
  });

export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

/**
 * 연결된 소셜 계정 목록 응답
 */
export const linkedAccountsResponseSchema = z
  .object({
    accounts: z.array(linkedAccountSchema).describe('연결된 소셜 계정 목록'),
  })
  .describe('연결된 소셜 계정 목록 응답')
  .meta({
    example: {
      accounts: [
        {
          provider: 'GOOGLE',
          providerAccountId: '102938475647382910',
          linkedAt: '2026-01-15T10:30:00.000Z',
        },
        {
          provider: 'APPLE',
          providerAccountId: '001234.abcd1234efgh5678.0123',
          linkedAt: '2026-01-10T09:00:00.000Z',
        },
      ],
    },
  });

export type LinkedAccountsResponse = z.infer<typeof linkedAccountsResponseSchema>;

/**
 * 소셜 계정 연결 해제 응답
 */
export const unlinkAccountResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    provider: oauthProviderEnumSchema.describe('연결 해제된 제공자'),
  })
  .describe('소셜 계정 연결 해제 응답')
  .meta({
    example: {
      message: '소셜 계정 연결이 해제되었습니다.',
      provider: 'GOOGLE',
    },
  });

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
  .describe('인증 에러 객체')
  .meta({
    example: {
      code: 'INVALID_CREDENTIALS',
      message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    },
  });

export type AuthError = z.infer<typeof authErrorSchema>;
