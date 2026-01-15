/**
 * 인증 관련 상수
 *
 * API와 Mobile에서 공유되는 상수들
 */

// ============================================
// 비밀번호 규칙
// ============================================

/** 비밀번호 검증 규칙 */
export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 72,
  /** 8자 이상, 영문과 숫자 필수 조합 */
  PATTERN: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
  ERROR_MESSAGE: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다',
} as const;

// ============================================
// Argon2 해싱 설정
// ============================================

/**
 * Argon2id 비밀번호 해싱 설정
 *
 * OWASP 권장 설정:
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const ARGON2_CONFIG = {
  /** 메모리 비용 (KB) - 64MB */
  MEMORY_COST: 65536,
  /** 반복 횟수 */
  TIME_COST: 3,
  /** 병렬 처리 스레드 수 */
  PARALLELISM: 4,
  /** 해시 길이 (bytes) */
  HASH_LENGTH: 32,
} as const;

// ============================================
// 인증 코드 설정
// ============================================

/** 인증 코드 설정 */
export const VERIFICATION_CODE = {
  /** 6자리 숫자 코드 */
  LENGTH: 6,
  /** 유효 시간 (분) */
  EXPIRY_MINUTES: 10,
  /** 최대 시도 횟수 */
  MAX_ATTEMPTS: 5,
  /** 재발송 대기 시간 (초) */
  RESEND_COOLDOWN_SECONDS: 60,
} as const;

// ============================================
// 로그인 실패 제한
// ============================================

/** 로그인 실패 제한 */
export const LOGIN_ATTEMPT = {
  /** 최대 실패 횟수 */
  MAX_FAILURES: 5,
  /** 잠금 시간 (분) */
  LOCKOUT_MINUTES: 15,
} as const;

// ============================================
// JWT 토큰 설정
// ============================================

/** JWT 토큰 설정 */
export const JWT_CONFIG = {
  /** Access Token 만료 시간 */
  ACCESS_EXPIRES_IN: '15m',
  /** Refresh Token 만료 시간 */
  REFRESH_EXPIRES_IN: '7d',
} as const;

// ============================================
// 디바이스 타입
// ============================================

/** 디바이스 타입 */
export const DEVICE_TYPES = ['IOS', 'ANDROID', 'WEB'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

// ============================================
// 사용자 상태
// ============================================

/** 사용자 상태 */
export const USER_STATUS = ['ACTIVE', 'LOCKED', 'SUSPENDED', 'PENDING_VERIFY'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

// ============================================
// 세션 폐기 사유 (공유)
// ============================================

/** 세션 폐기 사유 */
export const REVOKE_REASON = {
  /** 사용자 로그아웃 */
  USER_LOGOUT: 'USER_LOGOUT',
  /** 전체 기기 로그아웃 */
  USER_LOGOUT_ALL: 'USER_LOGOUT_ALL',
  /** 사용자가 특정 세션 폐기 */
  USER_REVOKE: 'USER_REVOKE',
  /** 토큰 재사용 감지 */
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  /** 비밀번호 재설정으로 인한 폐기 */
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type RevokeReason = (typeof REVOKE_REASON)[keyof typeof REVOKE_REASON];

// ============================================
// 보안 이벤트 타입 (공유)
// ============================================

/** 보안 로그 이벤트 타입 */
export const SECURITY_EVENT = {
  /** 회원가입 */
  REGISTRATION: 'REGISTRATION',
  /** 이메일 인증 완료 */
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  /** 로그인 성공 */
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  /** 로그아웃 */
  LOGOUT: 'LOGOUT',
  /** 토큰 갱신 */
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  /** 비밀번호 변경 */
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  /** 세션 폐기 */
  SESSION_REVOKED: 'SESSION_REVOKED',
  /** 모든 세션 폐기 */
  SESSION_REVOKED_ALL: 'SESSION_REVOKED_ALL',
  /** 의심스러운 활동 감지 */
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
} as const;

export type SecurityEvent = (typeof SECURITY_EVENT)[keyof typeof SECURITY_EVENT];

// ============================================
// 인증 타입 (공유)
// ============================================

/** 인증 타입 */
export const VERIFICATION_TYPE = {
  /** 이메일 인증 */
  EMAIL_VERIFY: 'EMAIL_VERIFY',
  /** 비밀번호 재설정 */
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type VerificationTypeValue = (typeof VERIFICATION_TYPE)[keyof typeof VERIFICATION_TYPE];
