import type { DeviceType, UserRole } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { TokenPair } from "../ports/auth-crypto.port.js";

/**
 * 회원가입 결과
 */
export interface RegisterResult {
  userId: string;
  email: string;
  emailSent: boolean;
  message: string;
}

/**
 * 이메일 인증 결과
 */
export interface VerifyEmailResult {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

/**
 * 로그인 결과
 */
export interface LoginResult {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  sessionId: string;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

/**
 * 소셜 로그인 결과. `isNewUser`는 이번 요청에서 사용자를 새로 만들었을 때만 true다.
 */
export interface SocialLoginResult extends LoginResult {
  isNewUser: boolean;
}

/**
 * 토큰 갱신 결과
 */
export interface RefreshTokensResult {
  tokens: TokenPair;
  sessionId: string;
}

/**
 * 요청 메타데이터
 */
export type RequestDevicePlatform = DeviceType;

/**
 * 요청 경계에서 정규화한 기기 정보. 관리자 알림 표시용이며 신뢰 판단에 쓰지 않는다.
 */
export interface RequestDevice {
  readonly devicePlatform?: RequestDevicePlatform;
  readonly deviceModel?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly appBuild?: string;
  /** Accept-Language 첫 언어 태그 (예: ko, en-US) */
  readonly locale?: string;
  /** X-Timezone IANA 시간대 */
  readonly timezone?: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  device?: RequestDevice;
  /** Accept-Language의 지원 언어. 보내지 않은 요청에는 없다. */
  locale?: SupportedLocale;
}

/**
 * 프로필 수정 결과
 */
export interface UpdateProfileResult {
  message: string;
  name: string | null;
  profileImage: string | null;
}

/**
 * OAuth 코드 교환 결과
 */
export interface ExchangeCodeResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  userName?: string;
  profileImage?: string;
  accountRestored?: boolean;
  isNewUser: boolean;
}

export interface DeleteAccountResult {
  message: string;
  deletedAt: string;
  gracePeriodDays: number;
}

/**
 * Passport Guard가 검증한 Refresh Token 정보
 */
export interface VerifiedRefreshPayload {
  userId: string;
  email: string;
  sessionId: string;
  role: UserRole;
}
