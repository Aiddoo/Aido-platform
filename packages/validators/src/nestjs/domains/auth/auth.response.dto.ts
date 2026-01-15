/**
 * Auth Response DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */
import { createZodDto } from 'nestjs-zod';

import {
  authTokensSchema,
  changePasswordResponseSchema,
  currentUserSchema,
  forgotPasswordResponseSchema,
  linkedAccountsResponseSchema,
  logoutResponseSchema,
  refreshTokensSchema,
  registerResponseSchema,
  resendVerificationResponseSchema,
  resetPasswordResponseSchema,
  sessionInfoSchema,
  sessionListResponseSchema,
  sessionListSchema,
  unlinkAccountResponseSchema,
  updateProfileResponseSchema,
  userProfileSchema,
} from '../../../domains/auth/auth.response';

// ============================================
// 토큰 응답 DTO
// ============================================

/** 인증 토큰 응답 DTO (userId 포함) */
export class AuthTokensDto extends createZodDto(authTokensSchema) {}

/** 토큰 갱신 응답 DTO (userId 미포함) */
export class RefreshTokensDto extends createZodDto(refreshTokensSchema) {}

// ============================================
// 사용자 정보 응답 DTO
// ============================================

/** 현재 사용자 정보 응답 DTO (GET /auth/me) */
export class CurrentUserDto extends createZodDto(currentUserSchema) {}

/** 사용자 프로필 응답 DTO */
export class UserProfileDto extends createZodDto(userProfileSchema) {}

// ============================================
// 세션 정보 응답 DTO
// ============================================

/** 세션 정보 응답 DTO */
export class SessionInfoDto extends createZodDto(sessionInfoSchema) {}

/** 세션 목록 응답 DTO ({ sessions: [...] } 형태) */
export class SessionListDto extends createZodDto(sessionListResponseSchema) {}

/** 세션 배열 DTO */
export class SessionArrayDto extends createZodDto(sessionListSchema) {}

// ============================================
// 메시지 응답 DTO
// ============================================

/** 단순 메시지 응답 DTO (로그아웃) */
export class MessageResponseDto extends createZodDto(logoutResponseSchema) {}

/** 회원가입 응답 DTO */
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}

/** 비밀번호 찾기 응답 DTO */
export class ForgotPasswordResponseDto extends createZodDto(forgotPasswordResponseSchema) {}

/** 비밀번호 재설정 응답 DTO */
export class ResetPasswordResponseDto extends createZodDto(resetPasswordResponseSchema) {}

/** 비밀번호 변경 응답 DTO */
export class ChangePasswordResponseDto extends createZodDto(changePasswordResponseSchema) {}

/** 인증 코드 재발송 응답 DTO */
export class ResendVerificationResponseDto extends createZodDto(resendVerificationResponseSchema) {}

/** 프로필 수정 응답 DTO */
export class UpdateProfileResponseDto extends createZodDto(updateProfileResponseSchema) {}

// ============================================
// OAuth 소셜 로그인 응답 DTO
// ============================================

/** 연결된 소셜 계정 목록 응답 DTO */
export class LinkedAccountsResponseDto extends createZodDto(linkedAccountsResponseSchema) {}

/** 소셜 계정 연결 해제 응답 DTO */
export class UnlinkAccountResponseDto extends createZodDto(unlinkAccountResponseSchema) {}
