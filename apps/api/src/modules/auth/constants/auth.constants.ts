/**
 * Auth 모듈 상수 정의
 *
 * 공유 상수는 @aido/validators에서 re-export
 * API 전용 상수만 여기서 정의
 */

// ============================================
// 공유 상수 re-export (@aido/validators)
// ============================================

export {
	ARGON2_CONFIG,
	REVOKE_REASON,
	type RevokeReason,
	SECURITY_EVENT,
	type SecurityEvent,
	VERIFICATION_TYPE,
	type VerificationTypeValue,
} from "@aido/validators";

// ============================================
// API 전용 상수
// ============================================

import type { AccountProvider } from "@/generated/prisma/client";

/**
 * 이메일 검증이 보장되는 신뢰된 OAuth Provider 목록
 *
 * Google, Apple: 항상 이메일이 검증됨
 * Kakao, Naver: 이메일 검증이 선택적 (사용자가 미인증 이메일 사용 가능)
 *
 * 신뢰된 Provider로 로그인 시, 동일 이메일의 기존 계정에 자동 연동
 */
export const TRUSTED_EMAIL_PROVIDERS: AccountProvider[] = ["GOOGLE", "APPLE"];

/** API 기본값 상수 */
export const AUTH_DEFAULTS = {
	/** 알 수 없는 IP 주소 */
	UNKNOWN_IP: "unknown",
	/** 알 수 없는 User Agent */
	UNKNOWN_USER_AGENT: "unknown",
	/** 기본 Access Token 만료 시간 (초) - 15분 */
	DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS: 900,
	/** Device Fingerprint 최대 길이 (DB schema @db.VarChar(64)와 일치) */
	MAX_DEVICE_FINGERPRINT_LENGTH: 64,
} as const;

// ============================================
// 로그인 실패 사유 (API 내부용)
// ============================================

export const LOGIN_FAILURE_REASON = {
	// 이메일 로그인 관련
	/** 사용자 없음 */
	USER_NOT_FOUND: "USER_NOT_FOUND",
	/** Credential 계정 없음 */
	NO_CREDENTIAL_ACCOUNT: "NO_CREDENTIAL_ACCOUNT",
	/** 비밀번호 불일치 */
	INVALID_PASSWORD: "INVALID_PASSWORD",

	// OAuth 로그인 관련
	/** OAuth 토큰 검증 실패 */
	OAUTH_TOKEN_INVALID: "OAUTH_TOKEN_INVALID",
	/** OAuth 토큰 만료 */
	OAUTH_TOKEN_EXPIRED: "OAUTH_TOKEN_EXPIRED",
	/** OAuth 프로바이더 오류 */
	OAUTH_PROVIDER_ERROR: "OAUTH_PROVIDER_ERROR",

	// 공통
	/** 계정 잠금 */
	ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
	/** 계정 정지 */
	ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
} as const;

export type LoginFailureReason =
	(typeof LOGIN_FAILURE_REASON)[keyof typeof LOGIN_FAILURE_REASON];

// ============================================
// 토큰 검증 결과 (API 내부용)
// ============================================

export const TOKEN_VERIFY_ERROR = {
	/** 토큰 만료 */
	EXPIRED: "expired",
	/** 서명 검증 실패 */
	INVALID_SIGNATURE: "invalid_signature",
	/** 잘못된 토큰 타입 */
	WRONG_TYPE: "wrong_type",
	/** 토큰 형식 오류 */
	MALFORMED: "malformed",
} as const;

export type TokenVerifyError =
	(typeof TOKEN_VERIFY_ERROR)[keyof typeof TOKEN_VERIFY_ERROR];

// ============================================
// Device Fingerprint 타입 (API 내부용)
// ============================================

/**
 * 디바이스 식별을 위한 fingerprint
 * 디바이스 이름 또는 User-Agent 문자열
 */
export type DeviceFingerprint = string;
