/**
 * Auth Request DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */
import { createZodDto } from 'nestjs-zod';

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  revokeSessionSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../../../domains/auth/auth.request';

/** 회원가입 요청 DTO */
export class RegisterDto extends createZodDto(registerSchema) {}

/** 로그인 요청 DTO */
export class LoginDto extends createZodDto(loginSchema) {}

/** 이메일 인증 요청 DTO */
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}

/** 인증 코드 재발송 요청 DTO */
export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}

/** 비밀번호 찾기 요청 DTO */
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

/** 비밀번호 재설정 요청 DTO */
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

/** 비밀번호 변경 요청 DTO */
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

/** 토큰 갱신 요청 DTO */
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

/** 세션 해제 요청 DTO */
export class RevokeSessionDto extends createZodDto(revokeSessionSchema) {}

/** 프로필 수정 요청 DTO */
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
