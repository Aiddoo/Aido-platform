/**
 * Auth Request DTO 스키마
 *
 * 인증 관련 요청 검증을 위한 Zod 스키마
 * .describe()를 사용하여 OpenAPI 문서 자동 생성
 */
import { z } from 'zod';

import { DEVICE_TYPES, PASSWORD_RULES, VERIFICATION_CODE } from './auth.constants';

// ============================================
// 공통 스키마 (재사용)
// ============================================

/** 이메일 스키마 */
export const emailSchema = z
  .string()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일은 255자 이내여야 합니다')
  .toLowerCase()
  .trim()
  .describe('사용자 이메일 주소');

/** 비밀번호 스키마 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.MIN_LENGTH, `비밀번호는 ${PASSWORD_RULES.MIN_LENGTH}자 이상이어야 합니다`)
  .max(PASSWORD_RULES.MAX_LENGTH, `비밀번호는 ${PASSWORD_RULES.MAX_LENGTH}자 이내여야 합니다`)
  .regex(PASSWORD_RULES.PATTERN, PASSWORD_RULES.ERROR_MESSAGE)
  .describe('비밀번호 (8자 이상, 영문자 1개 이상, 숫자 1개 이상 포함 필수)');

/** 디바이스 타입 스키마 */
export const deviceTypeSchema = z.enum(DEVICE_TYPES).describe('디바이스 타입 (IOS, ANDROID, WEB)');

// ============================================
// 회원가입 요청
// ============================================

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string().describe('비밀번호 확인 (password와 동일해야 함)'),
    name: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('사용자 이름 (선택)'),
    termsAgreed: z
      .literal(true, {
        message: '서비스 이용약관에 동의해주세요',
      })
      .describe('서비스 이용약관 동의 (필수, true만 허용)'),
    privacyAgreed: z
      .literal(true, {
        message: '개인정보처리방침에 동의해주세요',
      })
      .describe('개인정보처리방침 동의 (필수, true만 허용)'),
    marketingAgreed: z
      .boolean()
      .default(false)
      .describe('마케팅 정보 수신 동의 (선택, 기본값: false)'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  })
  .describe('회원가입 요청');

export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================
// 로그인 요청
// ============================================

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, '비밀번호를 입력해주세요').describe('비밀번호'),
    deviceName: z.string().max(100).optional().describe('기기 이름 (모바일 앱에서 세션 구분용)'),
    deviceType: deviceTypeSchema.optional(),
  })
  .describe('로그인 요청');

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// 이메일 인증 요청
// ============================================

export const verifyEmailSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .length(VERIFICATION_CODE.LENGTH, `인증 코드는 ${VERIFICATION_CODE.LENGTH}자리입니다`)
      .regex(/^\d+$/, '인증 코드는 숫자만 입력 가능합니다')
      .describe('이메일로 발송된 6자리 인증 코드'),
  })
  .describe('이메일 인증 요청');

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ============================================
// 인증 코드 재발송
// ============================================

export const resendVerificationSchema = z
  .object({
    email: emailSchema.describe('인증 코드를 재발송할 이메일 주소'),
  })
  .describe('인증 코드 재발송 요청');

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// ============================================
// 비밀번호 찾기 (재설정 코드 발송)
// ============================================

export const forgotPasswordSchema = z
  .object({
    email: emailSchema.describe('비밀번호를 재설정할 계정의 이메일 주소'),
  })
  .describe('비밀번호 찾기 요청');

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ============================================
// 비밀번호 재설정
// ============================================

export const resetPasswordSchema = z
  .object({
    email: emailSchema.describe('비밀번호를 재설정할 계정의 이메일 주소'),
    code: z.string().length(VERIFICATION_CODE.LENGTH).describe('이메일로 발송된 6자리 인증 코드'),
    newPassword: passwordSchema.describe(
      '새 비밀번호 (8자 이상, 영문자 1개 이상, 숫자 1개 이상 포함 필수)',
    ),
    newPasswordConfirm: z.string().describe('새 비밀번호 확인 (newPassword와 동일해야 함)'),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  })
  .describe('비밀번호 재설정 요청');

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================
// 비밀번호 변경 (로그인 상태)
// ============================================

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요').describe('현재 비밀번호'),
    newPassword: passwordSchema.describe(
      '새 비밀번호 (8자 이상, 영문자 1개 이상, 숫자 1개 이상 포함 필수, 현재 비밀번호와 달라야 함)',
    ),
    newPasswordConfirm: z.string().describe('새 비밀번호 확인 (newPassword와 동일해야 함)'),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '새 비밀번호는 현재 비밀번호와 달라야 합니다',
    path: ['newPassword'],
  })
  .describe('비밀번호 변경 요청');

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================
// 토큰 갱신 요청
// ============================================

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다').describe('리프레시 토큰'),
  })
  .describe('토큰 갱신 요청');

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// ============================================
// 세션 해제 요청
// ============================================

export const revokeSessionSchema = z
  .object({
    sessionId: z.string().cuid('유효하지 않은 세션 ID입니다').describe('해제할 세션 ID'),
  })
  .describe('세션 해제 요청');

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

// ============================================
// 프로필 수정 요청
// ============================================

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('사용자 이름'),
    profileImage: z
      .string()
      .url('올바른 URL 형식이 아닙니다')
      .max(500, '프로필 이미지 URL은 500자 이내여야 합니다')
      .optional()
      .nullable()
      .describe('프로필 이미지 URL (null로 설정 시 삭제)'),
  })
  .refine((data) => data.name !== undefined || data.profileImage !== undefined, {
    message: '최소 하나의 필드를 입력해주세요',
  })
  .describe('프로필 수정 요청');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================
// OAuth 소셜 로그인 요청
// ============================================

/** OAuth Provider 타입 */
export const oauthProviderSchema = z
  .enum(['APPLE', 'GOOGLE', 'KAKAO', 'NAVER'])
  .describe('소셜 로그인 제공자');

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/** Apple 로그인 콜백 요청 (모바일) - 서버에서 idToken 검증 */
export const appleMobileCallbackSchema = z
  .object({
    idToken: z
      .string()
      .min(1, 'Apple ID 토큰이 필요합니다')
      .describe('Apple에서 발급받은 ID Token (서버에서 JWKS로 검증)'),
    userName: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('Apple에서 제공한 사용자 이름 (첫 로그인 시에만 제공)'),
    deviceName: z.string().max(100).optional().describe('기기 이름 (모바일 앱에서 세션 구분용)'),
    deviceType: deviceTypeSchema.optional(),
  })
  .describe('Apple 모바일 로그인 콜백 요청');

export type AppleMobileCallbackInput = z.infer<typeof appleMobileCallbackSchema>;

/** Google 로그인 콜백 요청 (모바일) - 서버에서 idToken 검증 */
export const googleMobileCallbackSchema = z
  .object({
    idToken: z
      .string()
      .min(1, 'Google ID 토큰이 필요합니다')
      .describe('Google에서 발급받은 ID Token (서버에서 google-auth-library로 검증)'),
    userName: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('사용자 이름 (프로필에서 가져온 이름 대신 사용할 경우)'),
    deviceName: z.string().max(100).optional().describe('기기 이름 (모바일 앱에서 세션 구분용)'),
    deviceType: deviceTypeSchema.optional(),
  })
  .describe('Google 모바일 로그인 콜백 요청');

export type GoogleMobileCallbackInput = z.infer<typeof googleMobileCallbackSchema>;

/** Kakao 로그인 콜백 요청 (모바일) - 서버에서 accessToken 검증 */
export const kakaoMobileCallbackSchema = z
  .object({
    accessToken: z
      .string()
      .min(1, 'Kakao Access Token이 필요합니다')
      .describe('Kakao에서 발급받은 Access Token (서버에서 /v2/user/me API로 검증)'),
    userName: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('사용자 이름 (프로필에서 가져온 이름 대신 사용할 경우)'),
    deviceName: z.string().max(100).optional().describe('기기 이름 (모바일 앱에서 세션 구분용)'),
    deviceType: deviceTypeSchema.optional(),
  })
  .describe('Kakao 모바일 로그인 콜백 요청');

export type KakaoMobileCallbackInput = z.infer<typeof kakaoMobileCallbackSchema>;

/** Naver 로그인 콜백 요청 (모바일) - 서버에서 accessToken 검증 */
export const naverMobileCallbackSchema = z
  .object({
    accessToken: z
      .string()
      .min(1, 'Naver Access Token이 필요합니다')
      .describe('Naver에서 발급받은 Access Token (서버에서 /v1/nid/me API로 검증)'),
    userName: z
      .string()
      .max(100, '이름은 100자 이내여야 합니다')
      .trim()
      .optional()
      .describe('사용자 이름 (프로필에서 가져온 이름 대신 사용할 경우)'),
    deviceName: z.string().max(100).optional().describe('기기 이름 (모바일 앱에서 세션 구분용)'),
    deviceType: deviceTypeSchema.optional(),
  })
  .describe('Naver 모바일 로그인 콜백 요청');

export type NaverMobileCallbackInput = z.infer<typeof naverMobileCallbackSchema>;

/** 소셜 계정 연동 요청 (로그인된 사용자가 소셜 계정 추가 연동) */
export const linkSocialAccountSchema = z
  .object({
    provider: oauthProviderSchema.describe('연동할 소셜 로그인 제공자'),
    idToken: z.string().optional().describe('ID Token (Apple, Google용 - provider에 따라 필수)'),
    accessToken: z
      .string()
      .optional()
      .describe('Access Token (Kakao, Naver용 - provider에 따라 필수)'),
  })
  .refine(
    (data) => {
      // Apple, Google은 idToken 필수
      if (data.provider === 'APPLE' || data.provider === 'GOOGLE') {
        return !!data.idToken;
      }
      // Kakao, Naver는 accessToken 필수
      if (data.provider === 'KAKAO' || data.provider === 'NAVER') {
        return !!data.accessToken;
      }
      return true;
    },
    {
      message: 'Apple/Google은 idToken, Kakao/Naver는 accessToken이 필요합니다',
      path: ['idToken'],
    },
  )
  .describe('소셜 계정 연동 요청');

export type LinkSocialAccountInput = z.infer<typeof linkSocialAccountSchema>;

/** 소셜 계정 연결 해제 요청 */
export const unlinkAccountSchema = z
  .object({
    provider: oauthProviderSchema.describe('연결 해제할 소셜 로그인 제공자'),
  })
  .describe('소셜 계정 연결 해제 요청');

export type UnlinkAccountInput = z.infer<typeof unlinkAccountSchema>;

// ============================================
// OAuth 교환 코드 요청
// ============================================

/** OAuth 교환 코드로 토큰 획득 요청 */
export const exchangeCodeSchema = z
  .object({
    code: z
      .string()
      .min(1, '교환 코드가 필요합니다')
      .describe('OAuth 인증 후 발급된 일회용 교환 코드 (base64url 인코딩)'),
  })
  .describe('OAuth 토큰 교환 요청');

export type ExchangeCodeInput = z.infer<typeof exchangeCodeSchema>;
