import type { SubscriptionStatus, UserStatus } from "@/generated/prisma/client";
import type { TokenPair } from "../services/token.service";

/**
 * 회원가입 결과
 */
export interface RegisterResult {
	userId: string;
	email: string;
	message: string;
}

/**
 * 이메일 인증 결과
 */
export interface VerifyEmailResult {
	userId: string;
	tokens: TokenPair;
	name: string | null;
	profileImage: string | null;
}

/**
 * 로그인 결과
 */
export interface LoginResult {
	userId: string;
	tokens: TokenPair;
	sessionId: string;
	name: string | null;
	profileImage: string | null;
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
export interface RequestMetadata {
	ip?: string;
	userAgent?: string;
	deviceName?: string;
	deviceType?: string;
}

/**
 * 현재 사용자 정보 결과
 */
export interface CurrentUserResult {
	userId: string;
	email: string;
	sessionId: string;
	userTag: string;
	status: UserStatus;
	emailVerifiedAt: string | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: string | null;
	name: string | null;
	profileImage: string | null;
	createdAt: string;
}

/**
 * 프로필 수정 결과
 */
export interface UpdateProfileResult {
	message: string;
	name: string | null;
	profileImage: string | null;
}
