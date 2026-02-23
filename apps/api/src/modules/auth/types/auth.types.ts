import type {
	AccountProvider,
	SubscriptionStatus,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";
import type { TokenPair } from "../services/token.service";

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
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: string | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: string | null;
	name: string | null;
	profileImage: string | null;
	createdAt: string;
	providers: AccountProvider[];
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
}

export interface DeleteAccountResult {
	message: string;
	deletedAt: string;
	gracePeriodDays: number;
}
