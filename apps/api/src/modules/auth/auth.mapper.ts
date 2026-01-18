/**
 * Auth 모듈 매퍼 함수
 *
 * 인증 관련 서비스 결과를 API 응답 형식으로 변환하는 순수 함수들을 제공합니다.
 * 회원가입, 로그인, 토큰 갱신, 프로필 관리 등의 응답 변환을 담당합니다.
 *
 * @module auth.mapper
 */

import type {
	CurrentUserResult,
	ExchangeCodeResult,
	LoginResult,
	RefreshTokensResult,
	RegisterResult,
	UpdateProfileResult,
	VerifyEmailResult,
} from "./types/auth.types";

/**
 * 회원가입 결과를 API 응답 형식으로 변환합니다.
 *
 * @param result - 회원가입 처리 결과
 * @returns 회원가입 응답 객체
 *
 * @example
 * ```typescript
 * const result = await authService.register(dto);
 * return mapToRegisterResponse(result);
 * // { message: "...", email: "user@example.com" }
 * ```
 */
export function mapToRegisterResponse(result: RegisterResult) {
	return {
		message: result.message,
		email: result.email,
	};
}

/**
 * 이메일 인증 결과를 API 응답 형식으로 변환합니다.
 *
 * @param result - 이메일 인증 처리 결과
 * @returns 인증 토큰 응답 객체
 *
 * @example
 * ```typescript
 * const result = await authService.verifyEmail(dto, metadata);
 * return mapToAuthTokensResponse(result);
 * ```
 */
export function mapToAuthTokensResponse(
	result: VerifyEmailResult | LoginResult,
) {
	return {
		userId: result.userId,
		accessToken: result.tokens.accessToken,
		refreshToken: result.tokens.refreshToken,
		name: result.name,
		profileImage: result.profileImage,
	};
}

/**
 * 토큰 갱신 결과를 API 응답 형식으로 변환합니다.
 *
 * @param result - 토큰 갱신 처리 결과
 * @returns 갱신된 토큰 응답 객체
 *
 * @example
 * ```typescript
 * const result = await authService.refreshTokens(refreshToken);
 * return mapToRefreshTokensResponse(result);
 * ```
 */
export function mapToRefreshTokensResponse(result: RefreshTokensResult) {
	return {
		accessToken: result.tokens.accessToken,
		refreshToken: result.tokens.refreshToken,
	};
}

/**
 * 현재 사용자 정보를 API 응답 형식으로 변환합니다.
 *
 * @param result - 현재 사용자 정보 조회 결과
 * @returns 현재 사용자 응답 객체
 *
 * @example
 * ```typescript
 * const result = await authService.getCurrentUser(userId, sessionId);
 * return mapToCurrentUserResponse(result);
 * ```
 */
export function mapToCurrentUserResponse(result: CurrentUserResult) {
	return {
		userId: result.userId,
		email: result.email,
		sessionId: result.sessionId,
		userTag: result.userTag,
		status: result.status,
		emailVerifiedAt: result.emailVerifiedAt,
		subscriptionStatus: result.subscriptionStatus,
		subscriptionExpiresAt: result.subscriptionExpiresAt,
		name: result.name,
		profileImage: result.profileImage,
		createdAt: result.createdAt,
	};
}

/**
 * 프로필 수정 결과를 API 응답 형식으로 변환합니다.
 *
 * @param result - 프로필 수정 처리 결과
 * @returns 프로필 수정 응답 객체
 *
 * @example
 * ```typescript
 * const result = await authService.updateProfile(userId, dto);
 * return mapToUpdateProfileResponse(result);
 * ```
 */
export function mapToUpdateProfileResponse(result: UpdateProfileResult) {
	return {
		message: result.message,
		name: result.name,
		profileImage: result.profileImage,
	};
}

/**
 * 단순 메시지 응답을 생성합니다.
 *
 * @param message - 응답 메시지
 * @returns 메시지 응답 객체
 *
 * @example
 * ```typescript
 * return mapToMessageResponse("로그아웃되었습니다.");
 * ```
 */
export function mapToMessageResponse(message: string) {
	return { message };
}

/**
 * OAuth 코드 교환 결과를 API 응답 형식으로 변환합니다.
 *
 * @param result - OAuth 코드 교환 처리 결과
 * @returns 인증 토큰 응답 객체
 *
 * @example
 * ```typescript
 * const result = await oauthService.exchangeCodeForTokens(code);
 * return mapToExchangeCodeResponse(result);
 * ```
 */
export function mapToExchangeCodeResponse(result: ExchangeCodeResult) {
	return {
		userId: result.userId,
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		name: result.userName ?? null,
		profileImage: result.profileImage ?? null,
	};
}
